import { col, insertOne } from '../db/mongodb.js';

/** Append an entry to the audit log. Never throws — logging is best-effort. */
export async function audit({ user_id = null, action, target_type = '', target_id = null, details = {}, ip = '' }) {
  try {
    await insertOne('audit_logs', {
      user_id: user_id || null,
      action,
      target_type,
      target_id,
      details,
      ip: ip || '',
    });
  } catch (e) {
    console.error('[audit] failed to write entry:', e.message);
  }
}

export async function listAuditLogs({ page = 1, limit = 50, userId = null, action = null } = {}) {
  const filter = {};
  if (userId) filter.user_id = Number(userId);
  if (action) filter.action = action;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (p - 1) * l;

  const [rows, total] = await Promise.all([
    col('audit_logs').find(filter).sort({ created_at: -1 }).skip(skip).limit(l).toArray(),
    col('audit_logs').countDocuments(filter),
  ]);

  if (rows.length) {
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const users = await col('users')
      .find({ id: { $in: userIds } })
      .toArray();
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const r of rows) {
      const u = r.user_id != null ? byId.get(r.user_id) : null;
      r.user_name = u?.name || null;
      r.user_email = u?.email || null;
    }
  }

  return { rows, total };
}