import { col } from '../db/mongodb.js';
import { config } from '../config.js';
import { normalizeEmail, normalizePhone } from '../utils/helpers.js';

/**
 * Fraud detection heuristics run on each submission.
 * Returns an array of { code, message, severity } — severity: 'warn' | 'high'.
 */
export async function detectFraud({ agent_id, email, whatsapp_number, website_url, client_name, ip_address, device_fingerprint }) {
  const flags = [];
  const em = normalizeEmail(email);
  const ph = normalizePhone(whatsapp_number);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // 1) Near-identical / duplicate leads submitted by DIFFERENT agents.
  const crossRows = await col('leads')
    .aggregate([
      {
        $match: { agent_id: { $ne: agent_id }, $or: [{ email: em }, { whatsapp_number: ph }], created_at: { $gte: since } },
      },
      { $sort: { created_at: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: 'agent_id',
          foreignField: 'id',
          as: 'u',
        },
      },
      { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: 1,
          agent_id: 1,
          status: 1,
          created_at: 1,
          agent_name: '$u.name',
        },
      },
    ])
    .toArray();
  if (crossRows.length) {
    flags.push({
      code: 'cross_agent_duplicate',
      message: `Match with ${crossRows.length} lead(s) submitted by other agent(s) using the same email/WhatsApp (${crossRows.slice(0, 2).map((r) => r.agent_name).filter(Boolean).join(', ')}).`,
      severity: 'high',
      details: crossRows.map((r) => ({ lead_id: r.id, agent_id: r.agent_id, status: r.status })),
    });
  }

  // 2) Unusual submission velocity (rate per window).
  const velocitySince = new Date(Date.now() - config.validation.fraudVelocityWindowMin * 60 * 1000);
  const vel = await col('leads').countDocuments({ agent_id, created_at: { $gte: velocitySince } });
  if (vel >= config.validation.fraudVelocityMax) {
    flags.push({
      code: 'velocity_exceeded',
      message: `Agent submitted ${vel} leads in ${config.validation.fraudVelocityWindowMin} minutes — exceeds the allowed ${config.validation.fraudVelocityMax}.`,
      severity: 'high',
    });
  }

  // 3) Same device/IP across multiple agent accounts (multi-account abuse).
  if (device_fingerprint || ip_address) {
    const match = {};
    if (device_fingerprint) match.device_fingerprint = device_fingerprint;
    if (ip_address) match.ip_address = ip_address;
    const multiAcc = await col('leads').distinct('agent_id', { $or: [{ device_fingerprint: device_fingerprint || null }, { ip_address }], agent_id: { $ne: agent_id } });
    if (multiAcc.length) {
      flags.push({
        code: 'multi_account_device',
        message: `This device/IP is linked to ${multiAcc.length + 1} different agent account(s).`,
        severity: 'high',
      });
    }
  }

  // 4) Same agent resubmitting near-identical website/name for different contacts.
  if (website_url) {
    const near = await col('leads')
      .find({ agent_id, website_url: new RegExp('^' + escapeRe(String(website_url).trim()) + '$', 'i') })
      .sort({ created_at: -1 })
      .limit(3)
      .toArray();
    if (near.length >= 3) {
      flags.push({
        code: 'repeated_website',
        message: `This website was submitted ${near.length + 1} times by you with different contact info.`,
        severity: 'warn',
      });
    }
  }

  return flags;
}

function escapeRe(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}