import { col, insertOne } from '../db/mongodb.js';
import { getWithdrawalThresholds } from './settingsService.js';
import { agentBalance } from './commissionService.js';
import { notifyManagers, notifyUser } from './notificationService.js';
import { audit } from './auditService.js';

export async function payoutEligibility(agentId) {
  const thresholds = await getWithdrawalThresholds();
  const approved_total = await col('leads').countDocuments({ agent_id: Number(agentId), status: 'approved' });

  const lastPayout = await col('payout_requests')
    .findOne({ agent_id: Number(agentId), status: { $in: ['requested', 'processing', 'paid'] } }, { sort: { _id: -1 } });

  let current = approved_total;
  if (lastPayout) {
    current = await col('leads').countDocuments({ agent_id: Number(agentId), status: 'approved', created_at: { $gt: lastPayout.created_at } });
  }

  const needed = lastPayout ? thresholds.subsequent : thresholds.first;
  const progress = lastPayout ? Math.min(100, Math.round((current / thresholds.subsequent) * 100)) : 0;
  return {
    approved_total,
    threshold: lastPayout ? thresholds.subsequent : thresholds.first,
    first: thresholds.first,
    subsequent: thresholds.subsequent,
    since_last: current,
    needed,
    met: current >= needed,
    progress,
  };
}

export async function requestPayout({ agent, method, account_number, amount }) {
  const eligibility = await payoutEligibility(agent.id);
  if (!eligibility.met) {
    const e = new Error(`Withdrawal not yet unlocked. You need ${eligibility.needed - eligibility.since_last} more approved lead(s) (${eligibility.since_last}/${eligibility.needed}).`);
    e.status = 422;
    e.eligibility = eligibility;
    throw e;
  }

  if (!['bkash', 'nagad'].includes(method)) {
    const e = new Error('Payment method must be bKash or Nagad.');
    e.status = 422;
    throw e;
  }
  const account = String(account_number || '').replace(/\s/g, '');
  if (!/^\+?\d{10,15}$/.test(account)) {
    const e = new Error('Enter a valid ' + method.toUpperCase() + ' account number (11 digits).');
    e.status = 422;
    throw e;
  }
  const amt = Number(amount);
  const { balance } = await agentBalance(agent.id);
  if (!Number.isFinite(amt) || amt <= 0) {
    const e = new Error('Enter a valid payout amount.');
    e.status = 422;
    throw e;
  }
  if (amt > balance) {
    const e = new Error(`Requested amount exceeds available balance (৳${balance}).`);
    e.status = 422;
    throw e;
  }

  const payout = await insertOne('payout_requests', {
    agent_id: agent.id,
    amount: amt,
    method,
    account_number: account,
    approved_lead_basis: eligibility.approved_total,
    status: 'requested',
    proof_image_url: '',
    processing_note: '',
  });
  await notifyManagers({ type: 'payout_requested', title: 'New payout request', message: `${agent.name} requested ৳${amt} via ${method}.`, link: '/admin/payouts' });
  await audit({ user_id: agent.id, action: 'payout_requested', target_type: 'payout_request', target_id: payout.id, details: { method, account_number: account, amount: amt } });
  return { ...payout, _id: undefined };
}

export async function listPayouts({ filters = {}, page = 1, limit = 25, agentId = null } = {}) {
  const q = {};
  if (agentId) q.agent_id = Number(agentId);
  if (filters.id) q.id = Number(filters.id);
  if (filters.status) q.status = filters.status;
  if (filters.method) q.method = filters.method;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (p - 1) * l;

  const [raw, total] = await Promise.all([
    col('payout_requests').find(q).sort({ created_at: -1 }).skip(skip).limit(l).toArray(),
    col('payout_requests').countDocuments(q),
  ]);

  if (raw.length) {
    const userIds = [...new Set(raw.flatMap((r) => [r.agent_id, r.processed_by].filter((x) => x != null)))];
    const users = userIds.length ? await col('users').find({ id: { $in: userIds } }).toArray() : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const r of raw) {
      const agent = r.agent_id != null ? byId.get(r.agent_id) : null;
      const proc = r.processed_by != null ? byId.get(r.processed_by) : null;
      r.agent_name = agent?.name || null;
      r.agent_email = agent?.email || null;
      r.processed_by_name = proc?.name || null;
      r._id = undefined;
    }
  }

  return { rows: raw, total, page: p, limit: l };
}

export async function updatePayoutStatus({ payout, admin, status, note = '', proofFile = null }) {
  const allowed = { requested: ['processing', 'rejected'], processing: ['paid', 'rejected'] };
  const transitions = allowed[payout.status] || [];
  if (!transitions.includes(status)) {
    const e = new Error(`Cannot move payout from "${payout.status}" to "${status}".`);
    e.status = 422;
    throw e;
  }
  if (status === 'rejected' && !note.trim()) {
    const e = new Error('A note is required when rejecting a payout.');
    e.status = 422;
    throw e;
  }
  if (status === 'paid' && !payout.proof_image_url && !proofFile) {
    const e = new Error('Upload payment proof before marking the payout as paid.');
    e.status = 422;
    throw e;
  }

  const proofUrl = proofFile ? `/uploads/${proofFile.filename}` : payout.proof_image_url;
  await col('payout_requests').updateOne(
    { id: payout.id },
    { $set: { status, proof_image_url: proofUrl, processed_by: admin.id, processing_note: note, processed_at: new Date(), updated_at: new Date() } },
  );

  const updated = await col('payout_requests').findOne({ id: payout.id });
  const verbs = { processing: 'is being processed', paid: 'was paid successfully 🎉', rejected: 'could not be processed. Reason: ' + note };
  await notifyUser({ user_id: payout.agent_id, type: 'payout_status', title: `Payout request ${status}`, message: `Your ${methodLabel(updated.method)} payout request for ৳${updated.amount} ${verbs[status]}`, link: '/agent/payouts', email: true });
  await audit({ user_id: admin.id, action: `payout_${status}`, target_type: 'payout_request', target_id: payout.id, details: { note, amount: updated.amount } });
  return { ...updated, _id: undefined };
}

function methodLabel(m) {
  return m === 'bkash' ? 'bKash' : 'Nagad';
}

export async function payoutStats() {
  const agg = col('payout_requests').aggregate([
    {
      $group: {
        _id: null,
        requested: { $sum: { $cond: [{ $eq: ['$status', 'requested'] }, 1, 0] } },
        processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        total_paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
      },
    },
  ]);
  const [doc] = await agg.toArray();
  return {
    requested: doc?.requested || 0,
    processing: doc?.processing || 0,
    paid: doc?.paid || 0,
    rejected: doc?.rejected || 0,
    total_paid: +(doc?.total_paid || 0),
  };
}