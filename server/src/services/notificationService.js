import { col, insertOne } from '../db/mongodb.js';
import { sendEmail } from './emailService.js';

export async function createNotification({ user_id, type = 'info', title = '', message, link = '' }) {
  return insertOne('notifications', { user_id, type, title, message, link, is_read: false });
}

export async function notifyUser({ user_id, type, title, message, link = '', email = false }) {
  const notif = await createNotification({ user_id, type, title, message, link });
  if (email) {
    try {
      const u = await col('users').findOne({ id: user_id });
      if (u) await sendEmail({ to: u.email, subject: title || message.slice(0, 80), text: message, name: u.name });
    } catch (e) {
      console.error('[notify] email send failed:', e.message);
    }
  }
  return notif;
}

export async function listNotifications(user_id, { page = 1, limit = 30, unreadOnly = false } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 30));
  const skip = (p - 1) * l;
  const filter = { user_id };
  if (unreadOnly) filter.is_read = false;

  const [rows, unread, total] = await Promise.all([
    col('notifications').find(filter).sort({ created_at: -1 }).skip(skip).limit(l).toArray(),
    col('notifications').countDocuments({ user_id, is_read: false }),
    col('notifications').countDocuments({ user_id }),
  ]);
  return { rows, unread, total };
}

export async function markNotificationRead(user_id, notif_id) {
  await col('notifications').updateOne({ id: Number(notif_id), user_id }, { $set: { is_read: true } });
}

export async function markAllNotificationsRead(user_id) {
  await col('notifications').updateMany({ user_id, is_read: false }, { $set: { is_read: true } });
}

export async function notifyManagers({ type, title, message, link }) {
  const rows = await col('users').find({ role: { $in: ['super_admin', 'manager'] }, status: 'active' }).toArray();
  for (const row of rows) {
    await createNotification({ user_id: row.id, type, title, message, link });
  }
}