import { db, col } from '../db/mongodb.js';
import { runAutoValidation } from './autoValidation.js';
import { latestRate, runTxn } from '../services/commissionService.js';
import { getReferralPercent } from '../services/settingsService.js';
import { notifyManagers } from '../services/notificationService.js';
import { audit } from '../services/auditService.js';

/**
 * Worker handler: runs the auto-validation engine on a pending lead and moves
 * it to UNDER_REVIEW. High-trust agents with an obviously valid lead get a
 * lighter review path — auto-approved instantly.
 */
export async function processAutoValidation(job) {
  const { leadId } = job.data;
  const lead = await col('leads').findOne({ id: Number(leadId) });
  if (!lead) return { skipped: true, reason: 'lead_missing' };
  if (lead.status !== 'pending') return { skipped: true, reason: `status=${lead.status}` };

  const existingFlags = (lead.fraud_flags || []).filter((f) => f?.severity === 'high').map((f) => f.message);

  const { tag, notes } = await runAutoValidation({
    client_name: lead.client_name,
    email: lead.email,
    whatsapp_number: lead.whatsapp_number,
    website_url: lead.website_url,
    location: lead.location,
  });

  const finalTag = existingFlags.length ? 'likely_invalid' : tag;
  const notesObj = {
    ...notes,
    ...(existingFlags.length ? { fraud_flags_from_submission: existingFlags } : {}),
  };

  const agent = await col('users').findOne({ id: lead.agent_id }, { projection: { trust_score: 1 } });
  const trust = Number(agent?.trust_score || 0);

  const AUTO_APPROVE_TRUST = 85;
  const canAutoApprove = trust >= AUTO_APPROVE_TRUST && finalTag === 'likely_valid';

  await reviewOrQueue(lead.id, finalTag, notesObj, canAutoApprove);

  await audit({ user_id: null, action: 'auto_validation', target_type: 'lead', target_id: lead.id, details: { tag: finalTag, auto_approved: canAutoApprove } });

  if (finalTag === 'likely_invalid') {
    await notifyManagers({ type: 'validation', title: 'Suspicious lead flagged', message: `Lead #${lead.id} (${lead.client_name}) flagged as likely invalid by the validator.`, link: '/manager/review' });
  }

  return { tag: finalTag, auto_approved: canAutoApprove, trust };
}

async function reviewOrQueue(leadId, finalTag, notesObj, canAutoApprove) {
  if (canAutoApprove) {
    await runTxn(async (session) => {
      await db.collection('leads').updateOne(
        { id: Number(leadId) },
        { $set: { status: 'approved', auto_validation_tag: finalTag, auto_validation_notes: notesObj, reviewed_by: null, reviewed_at: new Date(), updated_at: new Date() } },
        { session },
      );
      await applyCommissionOnApproval({ session, lead_id: Number(leadId) });
    });
  } else {
    await col('leads').updateOne(
      { id: Number(leadId) },
      { $set: { status: 'under_review', auto_validation_tag: finalTag, auto_validation_notes: notesObj, updated_at: new Date() } },
    );
  }
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

/** Same rules as the role service, kept self-contained to avoid circular imports. */
async function applyCommissionOnApproval({ session, lead_id }) {
  const existing = await db.collection('earnings').findOne({ lead_id, type: 'per_lead' }, { session });
  if (existing) return;
  const rate = await latestRate('per_lead');
  if (!rate) return;
  const lead = await db.collection('leads').findOne({ id: lead_id }, { session });
  try {
    await db.collection('earnings').insertOne(await earningDoc(lead.agent_id, lead_id, rate.amount, 'per_lead', rate.id, 'auto approval (high trust)'), { session });
  } catch (e) {
    if (e.code === 11000) return;
    throw e;
  }
  const agent = await db.collection('users').findOne({ id: lead.agent_id }, { session });
  const referredBy = agent?.referred_by;
  if (referredBy) {
    const count = await db.collection('leads').countDocuments({ agent_id: lead.agent_id, status: 'approved' }, { session });
    if (count <= 50) {
      const percent = await getReferralPercent();
      const override = +((rate.amount * percent) / 100).toFixed(2);
      if (override > 0) {
        try {
          await db.collection('earnings').insertOne(await earningDoc(referredBy, lead_id, override, 'referral_override', rate.id, 'ref override (auto approval)'), { session });
        } catch (e) {
          if (e.code === 11000) return;
          throw e;
        }
      }
    }
  }
}