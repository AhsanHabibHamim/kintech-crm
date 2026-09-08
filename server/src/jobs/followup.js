import { col } from '../db/mongodb.js';
import { getFollowupDays } from '../services/settingsService.js';
import { notifyManagers } from '../services/notificationService.js';
import { audit } from '../services/auditService.js';

/** Lead follow-up sweeper: flags approved leads that sat too long without becoming Super Leads. */
export async function followupSweep() {
  const days = await getFollowupDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const notifiedBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await col('leads')
    .find({
      status: 'approved',
      is_super_lead: false,
      followup_flag: false,
      $and: [
        { $expr: { $lt: [{ $ifNull: ['$reviewed_at', '$created_at'] }, cutoff] } },
        { $or: [{ followup_notified_at: null }, { followup_notified_at: { $lt: notifiedBefore } }] },
      ],
    })
    .toArray();

  if (rows.length) {
    const now = new Date();
    await col('leads').updateMany(
      { id: { $in: rows.map((r) => r.id) } },
      { $set: { followup_flag: true, followup_notified_at: now, updated_at: now } },
    );
    for (const r of rows) {
      await notifyManagers({ type: 'followup', title: 'Lead needs follow-up', message: `Approved lead "${r.client_name}" (#${r.id}) hasn't converted — flag for sales follow-up.`, link: '/admin/leads?followup_flagged=true' });
      await audit({ user_id: null, action: 'followup_flagged', target_type: 'lead', target_id: r.id });
    }
  }
  return { flagged: rows.length };
}