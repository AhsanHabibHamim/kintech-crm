import { col } from '../db/mongodb.js';

const STATUS_POINTS = { approved: +1, rejected: -1, needs_info: 0 };

/** Recompute an agent's trust score from their accept/reject ratio (20..100). */
export async function recomputeTrustScore(agentId) {
  const agg = col('leads').aggregate([
    { $match: { agent_id: Number(agentId) } },
    {
      $group: {
        _id: null,
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        super_leads: { $sum: { $cond: [{ $eq: ['$is_super_lead', true] }, 1, 0] } },
      },
    },
  ]);
  const [doc] = await agg.toArray();
  const { approved = 0, rejected = 0, super_leads = 0 } = doc || {};
  const decided = approved + rejected;
  let score = 50;
  if (decided > 0) {
    const ratio = approved / decided;
    score = 20 + Math.round(ratio * 80);
  }
  score = Math.min(100, score + Math.min(10, super_leads));
  await col('users').updateOne({ id: Number(agentId) }, { $set: { trust_score: score } });
  return score;
}

export async function agentPerformance({ userId = null } = {}) {
  const match = { role: 'lead_agent' };
  if (userId) match.id = Number(userId);

  const agg = col('users').aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'leads',
        localField: 'id',
        foreignField: 'agent_id',
        as: 'leads',
      },
    },
    {
      $lookup: {
        from: 'earnings',
        localField: 'id',
        foreignField: 'agent_id',
        as: 'earnings',
      },
    },
    {
      $project: {
        id: 1,
        name: 1,
        email: 1,
        trust_score: 1,
        total_leads: { $size: '$leads' },
        approved_leads: { $size: { $filter: { input: '$leads', as: 'l', cond: { $eq: ['$$l.status', 'approved'] } } } },
        rejected_leads: { $size: { $filter: { input: '$leads', as: 'l', cond: { $eq: ['$$l.status', 'rejected'] } } } },
        pending_leads: { $size: { $filter: { input: '$leads', as: 'l', cond: { $eq: ['$$l.status', 'pending'] } } } },
        super_leads: { $size: { $filter: { input: '$leads', as: 'l', cond: { $eq: ['$$l.is_super_lead', true] } } } },
        total_earnings: { $sum: '$earnings.amount' },
        super_earnings: {
          $sum: { $filter: { input: '$earnings', as: 'e', cond: { $eq: ['$$e.type', 'super_lead_bonus'] } }, },
        },
      },
    },
    {
      $addFields: {
        total_earnings: { $round: [{ $ifNull: ['$total_earnings', 0] }, 2] },
        super_earnings: { $round: [{ $ifNull: ['$super_earnings', 0] }, 2] },
      },
    },
    {
      $project: {
        id: 1,
        name: 1,
        email: 1,
        trust_score: 1,
        total_leads: 1,
        approved_leads: 1,
        rejected_leads: 1,
        pending_leads: 1,
        super_leads: 1,
        total_earnings: 1,
        super_earnings: 1,
        accept_rate: {
          $cond: [{ $eq: ['$total_leads', 0] }, 0, { $round: [{ $multiply: [100, { $divide: ['$approved_leads', '$total_leads'] }] }, 1] }],
        },
      },
    },
    { $sort: { total_earnings: -1, approved_leads: -1 } },
  ]);

  const rows = await agg.toArray();
  return rows.map(({ _id, ...r }) => r);
}

export async function leaderboard({ period = 'month' }) {
  let since;
  if (period === 'week') since = startOfWeek();
  else if (period === 'all') since = new Date(0);
  else since = startOfMonth();

  const agg = col('users').aggregate([
    { $match: { role: 'lead_agent', status: 'active' } },
    {
      $lookup: {
        from: 'leads',
        let: { uid: '$id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$agent_id', '$$uid'] }, created_at: { $gte: since } } },
          { $project: { status: 1, is_super_lead: 1 } },
        ],
        as: 'leads',
      },
    },
    {
      $lookup: {
        from: 'earnings',
        let: { uid: '$id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$agent_id', '$$uid'] }, created_at: { $gte: since } } },
          { $project: { amount: 1 } },
        ],
        as: 'earnings',
      },
    },
    {
      $project: {
        id: 1,
        name: 1,
        email: 1,
        trust_score: 1,
        approved_leads: { $size: { $filter: { input: '$leads', as: 'l', cond: { $eq: ['$$l.status', 'approved'] } } } },
        super_leads: { $size: { $filter: { input: '$leads', as: 'l', cond: { $eq: ['$$l.is_super_lead', true] } } } },
        earnings: { $round: [{ $sum: '$earnings.amount' }, 2] },
      },
    },
    { $sort: { approved_leads: -1, super_leads: -1 } },
    { $limit: 20 },
  ]);

  const rows = await agg.toArray();
  return rows.map(({ _id, ...r }) => r);
}

export async function dashboardAnalytics() {
  const countByStatus = async () => {
    const agg = col('leads').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const docs = await agg.toArray();
    const m = new Map(docs.map((d) => [d._id, d.n]));
    return {
      total: docs.reduce((a, d) => a + d.n, 0),
      approved: m.get('approved') || 0,
      rejected: m.get('rejected') || 0,
      pending: m.get('pending') || 0,
      under_review: m.get('under_review') || 0,
      needs_info: m.get('needs_info') || 0,
      map: m,
    };
  };

  const [status, superLeads, agents, totalEarnings, paidOut, tagCounts, followup, disputes, approvalTotal] = await Promise.all([
    countByStatus(),
    col('leads').countDocuments({ is_super_lead: true }),
    col('users').countDocuments({ role: 'lead_agent' }),
    totalSum('earnings', 'amount'),
    col('payout_requests').aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, s: { $sum: '$amount' } } }]).toArray(),
    col('leads').aggregate([{ $group: { _id: '$auto_validation_tag', n: { $sum: 1 } } }]).toArray(),
    col('leads').countDocuments({ followup_flag: true }),
    col('leads').countDocuments({ dispute_requested: true }),
  ]);

  const tagMap = new Map(tagCounts.map((t) => [t._id, t.n]));
  const totalLeads = status.total;
  const approvalRate = totalLeads === 0 ? 0 : Math.round((status.approved / totalLeads) * 1000) / 10;
  const agentsPending = await col('users').countDocuments({ role: 'lead_agent', status: 'pending' });

  return {
    total_leads: totalLeads,
    approved_leads: status.approved,
    rejected_leads: status.rejected,
    pending_leads: status.pending,
    under_review: status.under_review,
    needs_info: status.needs_info,
    super_leads: superLeads,
    agents_count: agents,
    agents_pending: agentsPending,
    total_earnings: +totalEarnings,
    total_paid_out: +(paidOut[0]?.s || 0),
    approval_rate: approvalRate,
    t_likely_valid: tagMap.get('likely_valid') || 0,
    t_likely_invalid: tagMap.get('likely_invalid') || 0,
    t_needs_review: tagMap.get('needs_review') || 0,
    followup_flagged: followup,
    disputes_open: disputes,
  };
}

export async function monthlyTrends() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const agg = col('leads').aggregate([
    { $match: { created_at: { $gt: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        leads: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const docs = await agg.toArray();
  return docs.map((d) => ({ day: d._id, leads: d.leads, approved: d.approved }));
}

export async function servicesBreakdown() {
  const defs = [
    ['Web Dev', /web|website|site|ecommerce|e-commerce|shopify|wordpress|landing|saas/i],
    ['App Dev', /app|mobile|ios|android|flutter|application|software/i],
    ['Design', /design|ui|ux|graphic|logo|brand|artwork|figma/i],
    ['Marketing', /market|seo|ads|advert|social media|facebook|instagram|tiktok|linkedin|digital|campaign|influencer/i],
  ];
  const rows = await col('leads').find({}).toArray();
  const buckets = new Map();
  for (const r of rows) {
    const svc = String(r.service_interested_in || '');
    let label = 'Other';
    if (!svc.trim()) label = 'Not specified';
    else for (const [name, re] of defs) if (re.test(svc)) { label = name; break; }
    const cur = buckets.get(label) || { service: label, n: 0, approved: 0 };
    cur.n += 1;
    if (r.status === 'approved') cur.approved += 1;
    buckets.set(label, cur);
  }
  return [...buckets.values()].sort((a, b) => b.n - a.n);
}

async function totalSum(coll, field) {
  const agg = col(coll).aggregate([{ $group: { _id: null, s: { $sum: `$${field}` } } }]);
  const [doc] = await agg.toArray();
  return +(doc?.s || 0);
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}