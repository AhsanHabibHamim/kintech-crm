import { db, col, insertOne, mongo } from '../db/mongodb.js';

async function runTxn(cb) {
  const session = mongo.startSession();
  try {
    let res;
    await session.withTransaction(async () => {
      res = await cb(session);
    });
    return res;
  } finally {
    await session.endSession();
  }
}

/** Latest (history-tracked) rate for a given type. Never overwrites — newest row wins. */
export async function latestRate(type) {
  return col('commission_rates').findOne({ type }, { sort: { _id: -1 } });
}

export async function setRate({ type, amount, updated_by }) {
  const a = Number(amount);
  if (!['per_lead', 'super_lead'].includes(type)) {
    const e = new Error('Invalid rate type');
    e.status = 400;
    throw e;
  }
  if (!Number.isFinite(a) || a < 0) {
    const e = new Error('Amount must be a non-negative number');
    e.status = 422;
    throw e;
  }
  return insertOne('commission_rates', { type, amount: a, updated_by, effective_from: new Date() });
}

export async function rateHistory(type) {
  const rows = await col('commission_rates').find({ type }).sort({ _id: -1 }).limit(50).toArray();
  if (rows.length) {
    const userIds = [...new Set(rows.map((r) => r.updated_by).filter(Boolean))];
    const users = await col('users').find({ id: { $in: userIds } }).toArray();
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    for (const r of rows) r.updated_by_name = r.updated_by != null ? nameById.get(r.updated_by) ?? null : null;
  }
  return rows.map(({ _id, id, ...rest }) => ({ id, ...rest }));
}

/**
 * Compute available balance for an agent: total earnings − (requested + processing + paid).
 * Pass an optional session to run inside a transaction.
 */
export async function agentBalance(agent_id, session = null) {
  const earnedAgg = db
    .collection('earnings')
    .aggregate([{ $match: { agent_id } }, { $group: { _id: null, sum: { $sum: '$amount' } } }], session ? { session } : undefined);
  const paidAgg = db
    .collection('payout_requests')
    .aggregate([{ $match: { agent_id, status: { $in: ['requested', 'processing', 'paid'] } } }, { $group: { _id: null, sum: { $sum: '$amount' } } }], session ? { session } : undefined);
  const [earnedDoc, paidDoc] = [await earnedAgg.toArray(), await paidAgg.toArray()];
  const earned = earnedDoc[0]?.sum || 0;
  const paid = paidDoc[0]?.sum || 0;
  return { earned: +earned, paid: +paid, balance: +((earned - paid).toFixed(2)) };
}

export async function agentEarningsSummary(agent_id) {
  const agg = col('earnings').aggregate([
    { $match: { agent_id } },
    {
      $group: {
        _id: null,
        per_lead: { $sum: { $cond: [{ $eq: ['$type', 'per_lead'] }, '$amount', 0] } },
        super_lead: { $sum: { $cond: [{ $eq: ['$type', 'super_lead_bonus'] }, '$amount', 0] } },
        referral: { $sum: { $cond: [{ $eq: ['$type', 'referral_override'] }, '$amount', 0] } },
        total: { $sum: '$amount' },
      },
    },
  ]);
  const [r] = await agg.toArray();
  return {
    per_lead: +(r?.per_lead || 0),
    super_lead: +(r?.super_lead || 0),
    referral: +(r?.referral || 0),
    total: +(r?.total || 0),
  };
}

/** Detailed earnings ledger entries with the source lead context. */
export async function agentEarningsLedger(agent_id, { page = 1, limit = 30 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 30));
  const skip = (p - 1) * l;
  const rows = await col('earnings').find({ agent_id }).sort({ created_at: -1 }).skip(skip).limit(l).toArray();

  if (rows.length) {
    const leadIds = [...new Set(rows.map((r) => r.lead_id).filter(Boolean))];
    const rateIds = [...new Set(rows.map((r) => r.commission_rate_id).filter(Boolean))];
    const [leads, rates] = await Promise.all([
      leadIds.length ? col('leads').find({ id: { $in: leadIds } }).toArray() : [],
      rateIds.length ? col('commission_rates').find({ id: { $in: rateIds } }).toArray() : [],
    ]);
    const leadById = new Map(leads.map((l) => [l.id, l]));
    const rateById = new Map(rates.map((r) => [r.id, r]));
    for (const r of rows) {
      const lead = r.lead_id != null ? leadById.get(r.lead_id) : null;
      const rate = r.commission_rate_id != null ? rateById.get(r.commission_rate_id) : null;
      r.client_name = lead?.client_name || null;
      r.email = lead?.email || null;
      r.is_super_lead = lead?.is_super_lead || false;
      r.lead_status = lead?.status || null;
      r.rate_amount = rate?.amount ?? null;
    }
  }

  const total = await col('earnings').countDocuments({ agent_id });
  return { rows, total };
}

export { runTxn };