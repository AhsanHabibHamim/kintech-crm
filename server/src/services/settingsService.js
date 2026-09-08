import { col } from '../db/mongodb.js';
import { config } from '../config.js';

export async function getSetting(key, fallback = null) {
  const s = await col('settings').findOne({ _id: key });
  if (!s) return fallback;
  if (fallback !== null) return { ...fallback, ...s.value };
  return s.value;
}

export async function setSetting(key, value, updated_by = null) {
  await col('settings').updateOne(
    { _id: key },
    { $set: { value, updated_by, updated_at: new Date() } },
    { upsert: true },
  );
}

/** { first, subsequent } — approved-lead counts required between withdrawals. */
export async function getWithdrawalThresholds() {
  const t = await getSetting('withdrawal_thresholds', {
    first: config.defaults.firstWithdrawalLimit,
    subsequent: config.defaults.subsequentWithdrawalLimit,
  });
  return { first: t.first, subsequent: t.subsequent };
}

export async function getReferralPercent() {
  const r = await getSetting('referral_override_percent', { percent: 5 });
  return Number(r.percent);
}

export async function getFollowupDays() {
  const f = await getSetting('lead_followup_days', { days: config.validation.leadFollowupDays });
  return Number(f.days);
}