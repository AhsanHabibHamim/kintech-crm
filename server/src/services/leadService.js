import { col, insertOne } from '../db/mongodb.js';
import { sanitizeLeadInput } from '../utils/validators.js';
import { normalizeEmail, normalizePhone, fingerprintParts, sha256 } from '../utils/helpers.js';
import { detectFraud } from './fraudService.js';
import { latestRate, runTxn } from './commissionService.js';
import { getReferralPercent } from './settingsService.js';
import { notifyUser, notifyManagers } from './notificationService.js';
import { audit } from './auditService.js';

const REVIEWABLE = new Set(['pending', 'under_review', 'needs_info']);
const AGENT_EDITABLE = new Set(['pending', 'under_review', 'needs_info']);
const EDITABLE_FIELDS = ['client_name', 'email', 'whatsapp_number', 'website_url', 'social_links', 'location', 'service_interested_in', 'category', 'sub_service', 'client_niche'];

function escapeRe(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function leadWithJoins(lead) {
  const o = { ...lead, _id: undefined };
  delete o._id;
  return o;
}

async function attachLeadRefs(leads) {
  if (!leads.length) return leads;
  const histEditorIds = leads.flatMap((l) => (l.edit_history || []).map((h) => h.editor_id).filter((x) => x != null));
  const userIds = [...new Set([...leads.flatMap((l) => [l.agent_id, l.reviewed_by].filter((x) => x != null)), ...histEditorIds])];
  const users = userIds.length ? await col('users').find({ id: { $in: userIds } }).toArray() : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return leads.map((l) => {
    const agent = l.agent_id != null ? byId.get(l.agent_id) : null;
    const reviewer = l.reviewed_by != null ? byId.get(l.reviewed_by) : null;
    return {
      ...leadWithJoins(l),
      agent_name: agent?.name || null,
      agent_email: agent?.email || null,
      agent_trust_score: agent?.trust_score ?? null,
      reviewed_by_name: reviewer?.name || null,
      reviewer_name: reviewer?.name || null,
      edit_history: (l.edit_history || []).map((h) => ({ ...h, editor_name: h.editor_id != null ? byId.get(h.editor_id)?.name || null : null })),
    };
  });
}

export async function duplicateCheck({ email, whatsapp_number, excludeLeadId = null }) {
  const em = normalizeEmail(email);
  const ph = normalizePhone(whatsapp_number);
  const filter = { $or: [{ email: em }, { whatsapp_number: ph }] };
  if (excludeLeadId != null) filter.id = { $ne: Number(excludeLeadId) };
  const lead = await col('leads').findOne(filter, { sort: { created_at: -1 } });
  return lead ? leadWithJoins(lead) : null;
}

export async function createLead({ agent, body, ip }) {
  const input = sanitizeLeadInput(body);

  const dup = await duplicateCheck({ email: input.email, whatsapp_number: input.whatsapp_number });
  if (dup) {
    const e = new Error(
      dup.email === input.email
        ? 'This email has already been submitted as a lead by ' + (dup.agent_id === agent.id ? 'you' : 'another agent') + '. Duplicate leads are not allowed.'
        : 'This WhatsApp number has already been submitted as a lead. Duplicate leads are not allowed.',
    );
    e.status = 409;
    throw e;
  }

  const ip_address = ip || '';
  const device_fingerprint = agent.device_fingerprint || sha256(fingerprintParts(ip, agent.id + Date.now())).slice(0, 32);

  const fraudFlags = await detectFraud({
    agent_id: agent.id,
    email: input.email,
    whatsapp_number: input.whatsapp_number,
    website_url: input.website_url,
    social_links: input.social_links,
    client_name: input.client_name,
    ip_address,
    device_fingerprint,
  });

  await col('users').updateOne({ id: agent.id }, { $set: { device_fingerprint, last_ip: ip_address } });

  let fraudInfluenced = null;
  if (fraudFlags.some((f) => f.severity === 'high')) {
    fraudInfluenced = 'likely_invalid';
  }

  const lead = await insertOne('leads', {
    agent_id: agent.id,
    client_name: input.client_name,
    email: input.email,
    whatsapp_number: input.whatsapp_number,
    website_url: input.website_url,
    social_links: input.social_links || [],
    location: input.location,
    service_interested_in: input.service_interested_in,
    category: input.category || '',
    sub_service: input.sub_service || '',
    client_niche: input.client_niche || '',
    ip_address,
    device_fingerprint,
    fraud_flags: fraudFlags,
    status: 'pending',
    auto_validation_tag: 'needs_review',
    auto_validation_notes: {},
    rejection_reason: '',
    dispute_requested: false,
    dispute_note: '',
    is_super_lead: false,
    followup_flag: false,
  });

  if (fraudInfluenced) {
    await col('leads').updateOne(
      { id: lead.id },
      { $set: { auto_validation_tag: fraudInfluenced }, $push: { 'auto_validation_notes.fraud': { $each: [fraudFlags] } } },
    );
  }

  await audit({ user_id: agent.id, action: 'lead_submitted', target_type: 'lead', target_id: lead.id, details: { fraud_flags: fraudFlags.length }, ip: ip_address });

  return { lead: leadWithJoins(lead), fraud_flags: fraudFlags };
}

export async function getLeadForReview(leadId) {
  const lead = await col('leads').findOne({ id: Number(leadId) });
  if (!lead) return null;
  const [byRefs] = await attachLeadRefs([lead]);
  return byRefs;
}

/**
 * Edit a lead's details.
 * - Agents: own lead only, and only while it is pending / under_review / needs_info.
 *   Editing an open lead resubmits it: status → pending (re-validated, back in the queue).
 * - Staff (admin / manager): may edit any lead at any time; approved/rejected status is kept.
 * Every edit is recorded in edit_history and cleared review/dispute state on resubmit.
 */
export async function editLead({ lead, editor, body, note = '' }) {
  const isAgent = editor.role === 'lead_agent';

  if (isAgent) {
    if (lead.agent_id !== editor.id) {
      const e = new Error('You can only edit your own leads.');
      e.status = 403;
      throw e;
    }
    if (!AGENT_EDITABLE.has(lead.status)) {
      const e = new Error(`This lead cannot be edited anymore — it is already "${lead.status}".`);
      e.status = 422;
      throw e;
    }
  }

  const input = sanitizeLeadInput(body);

  const dup = await duplicateCheck({ email: input.email, whatsapp_number: input.whatsapp_number, excludeLeadId: lead.id });
  if (dup) {
    const e = new Error(
      dup.email === input.email
        ? 'This email is already used by another lead.'
        : 'This WhatsApp number is already used by another lead.',
    );
    e.status = 409;
    throw e;
  }

  const changed = EDITABLE_FIELDS.filter((f) => {
    const a = Array.isArray(input[f]) ? input[f].join('|') : String(input[f] ?? '');
    const b = Array.isArray(lead[f]) ? lead[f].join('|') : String(lead[f] ?? '');
    return a.trim() !== b.trim();
  });

  if (!changed.length && !note.trim()) {
    const e = new Error('No changes were made to this lead.');
    e.status = 422;
    throw e;
  }

  const wasOpen = AGENT_EDITABLE.has(lead.status);

  const $set = {
    client_name: input.client_name,
    email: input.email,
    whatsapp_number: input.whatsapp_number,
    website_url: input.website_url,
    social_links: input.social_links || [],
    location: input.location,
    service_interested_in: input.service_interested_in,
    category: input.category || '',
    sub_service: input.sub_service || '',
    client_niche: input.client_niche || '',
    last_edited_by: editor.id,
    last_edited_at: new Date(),
    updated_at: new Date(),
  };

  if (wasOpen) {
    $set.status = 'pending';
    $set.rejection_reason = '';
    $set.info_request = '';
    $set.reviewed_by = null;
    $set.reviewed_at = null;
    $set.dispute_requested = false;
    $set.dispute_note = '';
  }

  const entry = {
    editor_id: editor.id,
    editor_role: editor.role,
    edited_at: new Date(),
    note: note.trim(),
    fields: changed,
  };

  await col('leads').updateOne({ id: lead.id }, { $set, $push: { edit_history: entry } });

  await audit({ user_id: editor.id, action: 'lead_edited', target_type: 'lead', target_id: lead.id, details: { fields: changed, note: note.trim() } });

  if (isAgent && wasOpen) {
    await notifyManagers({
      type: 'lead_edited',
      title: 'Lead updated by agent',
      message: `Agent updated lead "${lead.client_name}" (#${lead.id}) — resubmitted for review.`,
      link: '/manager/review',
    });
  }

  return getLeadForReview(lead.id);
}

export async function reviewLead({ lead, reviewer, action, reason = '', note = '' }) {
  if (!REVIEWABLE.has(lead.status)) {
    const e = new Error(`Lead cannot be reviewed from status "${lead.status}".`);
    e.status = 422;
    throw e;
  }

  if (action === 'approved') {
    await approveLead({ lead, reviewer, note });
  } else if (action === 'rejected') {
    const r = reason.trim();
    if (!r) {
      const e = new Error('A rejection reason is required so the agent can improve.');
      e.status = 422;
      throw e;
    }
    await col('leads').updateOne(
      { id: lead.id },
      { $set: { status: 'rejected', rejection_reason: r, auto_validation_tag: note || lead.auto_validation_tag, reviewed_by: reviewer.id, reviewed_at: new Date(), updated_at: new Date() } },
    );
  } else if (action === 'needs_info') {
    await col('leads').updateOne(
      { id: lead.id },
      { $set: { status: 'needs_info', rejection_reason: '', info_request: note || '', reviewed_by: reviewer.id, reviewed_at: new Date(), updated_at: new Date() } },
    );
  } else {
    const e = new Error('Invalid action.');
    e.status = 400;
    throw e;
  }

  const message =
    action === 'approved'
      ? 'Your lead for "' + lead.client_name + '" was approved.'
      : action === 'rejected'
        ? 'Your lead for "' + lead.client_name + '" was rejected: ' + reason
        : 'Your lead for "' + lead.client_name + '" needs more information.';

  await notifyUser({ user_id: lead.agent_id, type: 'lead_status', title: 'Lead ' + lead.client_name + ' → ' + action, message, link: '/agent/leads', email: true });
  if (action === 'approved') {
    await notifyManagers({ type: 'lead_approved', title: 'Lead approved', message: `${lead.client_name} was approved (commissions applied).`, link: '/manager/review' });
  }

  const fresh = await getLeadForReview(lead.id);
  await audit({ user_id: reviewer.id, action: `lead_${action}`, target_type: 'lead', target_id: lead.id, details: { reason, note }, ip: reviewer.last_ip });
  return fresh;
}

/** Approve a lead + apply commission. Idempotent. */
export async function approveLead({ lead, reviewer, note = '' }) {
  await runTxn(async (session) => {
    await col('leads').updateOne(
      { id: lead.id, status: { $in: [...REVIEWABLE] } },
      { $set: { status: 'approved', auto_validation_tag: note || lead.auto_validation_tag, reviewed_by: reviewer.id, reviewed_at: new Date(), updated_at: new Date() } },
      { session },
    );
    await applyCommissionOnApproval({ session, lead_id: lead.id, agent_id: lead.agent_id });
  });
}

async function earningDoc(agent_id, lead_id, amount, type, commission_rate_id, note) {
  const { val } = await col('counters').findOneAndUpdate({ _id: 'earnings' }, { $inc: { val: 1 } }, { upsert: true, returnDocument: 'after' });
  return {
    _id: val,
    id: val,
    agent_id,
    lead_id,
    amount,
    type,
    commission_rate_id,
    note,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Commission engine (idempotent): per_lead earning + referral override.
 * The earnings unique index (lead_id, type) guarantees no double pays even if
 * two approvals race.
 */
async function applyCommissionOnApproval({ session, lead_id, agent_id }) {
  const existing = await col('earnings').findOne({ lead_id, type: 'per_lead' }, { session });
  if (existing) return;

  const rate = await latestRate('per_lead');
  if (!rate) return;

  try {
    await col('earnings').insertOne(await earningDoc(agent_id, lead_id, rate.amount, 'per_lead', rate.id, 'auto on approval'), { session });
  } catch (e) {
    if (e.code === 11000) return; // duplicate key — already credited
    throw e;
  }

  const agent = await col('users').findOne({ id: agent_id }, { session });
  const referredBy = agent?.referred_by;
  if (referredBy) {
    const count = await col('leads').countDocuments({ agent_id, status: 'approved' }, { session });
    if (count <= 50) {
      const percent = await getReferralPercent();
      const override = +((rate.amount * percent) / 100).toFixed(2);
      if (override > 0) {
        try {
          await col('earnings').insertOne(await earningDoc(referredBy, lead_id, override, 'referral_override', rate.id, 'referral override on referred agent lead'), { session });
        } catch (e) {
          if (e.code === 11000) return;
          throw e;
        }
      }
    }
  }
}

export async function markSuperLead({ lead, user }) {
  if (lead.status !== 'approved') {
    const e = new Error('Only approved leads can be marked as Super Lead.');
    e.status = 422;
    throw e;
  }

  await runTxn(async (session) => {
    await col('leads').updateOne(
      { id: lead.id, is_super_lead: { $ne: true } },
      { $set: { is_super_lead: true, super_lead_marked_by: user.id, super_lead_marked_at: new Date(), followup_flag: false, updated_at: new Date() } },
      { session },
    );
    const existing = await col('earnings').findOne({ lead_id: lead.id, type: 'super_lead_bonus' }, { session });
    if (!existing) {
      const rate = await latestRate('super_lead');
      if (rate) {
        try {
          await col('earnings').insertOne(await earningDoc(lead.agent_id, lead.id, rate.amount, 'super_lead_bonus', rate.id, 'auto on super lead mark'), { session });
        } catch (e) {
          if (e.code === 11000) return;
          throw e;
        }
      }
    }
  });

  await notifyUser({ user_id: lead.agent_id, type: 'super_lead', title: 'Super Lead! 🎉', message: `Your lead "${lead.client_name}" is now a Super Lead. Bonus commission credited.`, link: '/agent/earnings', email: true });
  await audit({ user_id: user.id, action: 'lead_super_lead', target_type: 'lead', target_id: lead.id });
  return getLeadForReview(lead.id);
}

export async function bulkReview({ leadIds, reviewer, action, reason = '' }) {
  if (!['approved', 'rejected', 'needs_info'].includes(action)) {
    const e = new Error('Invalid action.');
    e.status = 400;
    throw e;
  }
  const idList = Array.isArray(leadIds) ? leadIds.map(Number).filter(Boolean) : [];
  if (!idList.length) {
    const e = new Error('No leads selected.');
    e.status = 422;
    throw e;
  }
  if (action === 'rejected' && !reason.trim()) {
    const e = new Error('A rejection reason is required for bulk rejection.');
    e.status = 422;
    throw e;
  }

  const results = { approved: 0, rejected: 0, needs_info: 0, skipped: 0, errors: [] };
  for (const id of idList) {
    try {
      const lead = await getLeadForReview(id);
      if (!lead) {
        results.skipped++;
        continue;
      }
      if (!REVIEWABLE.has(lead.status)) {
        results.skipped++;
        continue;
      }
      await reviewLead({ lead, reviewer, action, reason: action === 'rejected' ? reason : '' });
      results[action === 'approved' ? 'approved' : action] += 1;
    } catch (e) {
      results.errors.push({ id, message: e.message });
    }
  }
  await audit({ user_id: reviewer.id, action: `bulk_${action}`, target_type: 'lead', details: { count: idList.length, results } });
  return results;
}

export async function requestDispute({ lead, agent, note }) {
  if (lead.agent_id !== agent.id) {
    const e = new Error('You can only dispute your own leads.');
    e.status = 403;
    throw e;
  }
  if (lead.status !== 'rejected') {
    const e = new Error('Only rejected leads can be disputed.');
    e.status = 422;
    throw e;
  }
  if (lead.dispute_requested) {
    const e = new Error('A dispute is already pending for this lead.');
    e.status = 422;
    throw e;
  }
  if (!note.trim()) {
    const e = new Error('Please explain why this lead should be re-reviewed.');
    e.status = 422;
    throw e;
  }
  await col('leads').updateOne({ id: lead.id }, { $set: { dispute_requested: true, dispute_note: note.trim() } });
  await notifyManagers({ type: 'dispute', title: 'Dispute filed', message: `${agent.name} disputed the rejection of lead "${lead.client_name}".`, link: '/manager/disputes' });
  await audit({ user_id: agent.id, action: 'dispute_requested', target_type: 'lead', target_id: lead.id, details: { note } });
  return true;
}

export async function resolveDispute({ lead, user, action, reason = '' }) {
  if (!lead.dispute_requested) {
    const e = new Error('This lead has no pending dispute.');
    e.status = 422;
    throw e;
  }
  if (action === 'approved') {
    await approveLead({ lead, reviewer: user });
  } else if (action !== 'rejected') {
    const e = new Error('Invalid dispute resolution.');
    e.status = 400;
    throw e;
  }
  await col('leads').updateOne(
    { id: lead.id },
    {
      $set: {
        dispute_requested: false,
        dispute_note: action === 'rejected' ? lead.dispute_note : '',
        dispute_resolved_by: user.id,
        dispute_resolved_at: new Date(),
      },
    },
  );
  await audit({ user_id: user.id, action: `dispute_${action}`, target_type: 'lead', target_id: lead.id, details: { reason } });
  return getLeadForReview(lead.id);
}

export async function listLeads({ filters = {}, page = 1, limit = 25, userId = null, role = null } = {}) {
  const q = {};

  if (role === 'lead_agent' && userId) {
    q.agent_id = Number(userId);
  }

  if (filters.status) q.status = filters.status;
  if (filters.statuses && Array.isArray(filters.statuses)) q.status = { $in: filters.statuses };
  if (filters.tag) q.auto_validation_tag = filters.tag;
  if (filters.service) q.service_interested_in = filters.service;
  if (filters.category) q.category = filters.category;
  if (filters.client_niche) q.client_niche = filters.client_niche;
  if (filters.q) {
    const re = new RegExp(escapeRe(String(filters.q)).toLowerCase().replace(/\\/g, '\\'), 'i');
    q.$or = [{ client_name: re }, { email: re }, { whatsapp_number: re }, { website_url: re }];
  }
  if (filters.agent_id) q.agent_id = Number(filters.agent_id);
  if (filters.super_lead === 'true' || filters.super_lead === true) q.is_super_lead = true;
  if (filters.from || filters.to) {
    q.created_at = {};
    if (filters.from) {
      const f = new Date(filters.from);
      if (!isNaN(f)) q.created_at.$gte = f;
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!isNaN(to)) {
        to.setDate(to.getDate() + 1);
        q.created_at.$lt = to;
      }
    }
  }
  if (filters.followup_flagged === 'true') q.followup_flag = true;
  if (filters.dispute === 'true') q.dispute_requested = true;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (p - 1) * l;

  const [raw, total] = await Promise.all([
    col('leads').find(q).sort({ created_at: -1 }).skip(skip).limit(l).toArray(),
    col('leads').countDocuments(q),
  ]);
  const rows = await attachLeadRefs(raw);
  return { rows, total, page: p, limit: l };
}

export async function leadCountsByStatus(agentId) {
  const agg = col('leads').aggregate([
    { $match: { agent_id: Number(agentId) } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const docs = await agg.toArray();
  return docs.map((d) => ({ status: d._id, n: d.n }));
}