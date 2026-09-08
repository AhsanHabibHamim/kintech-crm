import bcrypt from 'bcryptjs';
import { col, insertOne } from '../db/mongodb.js';
import { normalizeEmail, referralCode, publicUser } from '../utils/helpers.js';
import { notifyUser } from './notificationService.js';
import { audit } from './auditService.js';

export async function listUsers({ filters = {}, page = 1, limit = 25 } = {}) {
  const q = {};
  if (filters.role) q.role = filters.role;
  if (filters.status) q.status = filters.status;
  if (filters.q) {
    const re = new RegExp(String(filters.q).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (p - 1) * l;

  const [rows, total] = await Promise.all([
    col('users').find(q).sort({ created_at: -1 }).skip(skip).limit(l).toArray(),
    col('users').countDocuments(q),
  ]);

  if (rows.length) {
    const refs = [...new Set(rows.map((r) => r.referred_by).filter(Boolean))];
    const refUsers = refs.length
      ? await col('users').find({ id: { $in: refs } }).toArray()
      : [];
    const nameById = new Map(refUsers.map((u) => [u.id, u.name]));
    for (const r of rows) r.referred_by_name = r.referred_by != null ? nameById.get(r.referred_by) ?? null : null;
  }

  return { rows, total, page: p, limit: l };
}

export async function approveAgent(userId, adminId) {
  const res = await col('users').findOneAndUpdate(
    { id: Number(userId), role: 'lead_agent', status: 'pending' },
    { $set: { status: 'active', updated_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!res) throw Object.assign(new Error('Agent not found or not in pending state.'), { status: 404 });
  await notifyUser({ user_id: userId, type: 'account', title: 'Account approved 🎉', message: 'Your Lead Agent account was approved. You can now submit leads.', link: '/agent', email: true });
  await audit({ user_id: adminId, action: 'agent_approved', target_type: 'user', target_id: userId });
  return publicUser(res);
}

export async function rejectAgent(userId, adminId) {
  const res = await col('users').findOneAndDelete({ id: Number(userId), role: 'lead_agent', status: 'pending' });
  if (!res) throw Object.assign(new Error('Pending agent not found.'), { status: 404 });
  await audit({ user_id: adminId, action: 'agent_rejected', target_type: 'user', target_id: userId, details: { email: res.email } });
  return true;
}

export async function toggleUserStatus(userId, status, adminId) {
  if (!['active', 'suspended'].includes(status)) throw Object.assign(new Error('Invalid status.'), { status: 400 });
  const res = await col('users').findOneAndUpdate(
    { id: Number(userId) },
    { $set: { status, updated_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!res) throw Object.assign(new Error('User not found.'), { status: 404 });
  audit({ user_id: adminId, action: `user_${status}`, target_type: 'user', target_id: userId });
  return { id: res.id, name: res.name, status: res.status, role: res.role };
}

export async function changeUserRole(userId, role, adminId) {
  if (!['manager', 'lead_agent'].includes(role)) throw Object.assign(new Error('Invalid role. Only Manager or Agent roles are allowed.'), { status: 400 });
  const current = await col('users').findOne({ id: Number(userId) });
  if (!current) throw Object.assign(new Error('User not found.'), { status: 404 });
  if (current.role === 'super_admin') throw Object.assign(new Error('Admin roles cannot be changed.'), { status: 400 });
  if (current.role === role) return { id: current.id, name: current.name, role: current.role };
  const set = { role, updated_at: new Date() };
  if (role === 'lead_agent') set.permissions = {};
  const res = await col('users').findOneAndUpdate({ id: Number(userId) }, { $set: set, $inc: { token_version: 1 } }, { returnDocument: 'after' });
  if (!res) throw Object.assign(new Error('User not found.'), { status: 404 });
  audit({ user_id: adminId, action: 'user_role_changed', target_type: 'user', target_id: userId, details: { role } });
  return { id: res.id, name: res.name, role: res.role };
}

export async function setUserPermission(userId, permission, value, adminId) {
  const permitted = ['manage_rates', 'manage_payouts', 'manage_users'];
  if (!permitted.includes(permission)) throw Object.assign(new Error('Unknown permission.'), { status: 400 });
  const res = await col('users').findOneAndUpdate(
    { id: Number(userId), role: 'manager' },
    { $set: { [`permissions.${permission}`]: value === true || value === 'true', updated_at: new Date() } },
    { returnDocument: 'after' },
  );
  if (!res) throw Object.assign(new Error('Manager not found.'), { status: 404 });
  audit({ user_id: adminId, action: 'user_permission_changed', target_type: 'user', target_id: userId, details: { permission, value } });
  return { id: res.id, name: res.name, permissions: res.permissions || {} };
}

export async function createUser({ name, email, phone, role, password, barAdmin }) {
  if (!['manager', 'lead_agent'].includes(role)) throw Object.assign(new Error('Can only create Manager or Lead Agent accounts.'), { status: 400 });
  const em = normalizeEmail(email);
  const exists = await col('users').findOne({ email: em });
  if (exists) throw Object.assign(new Error('A user with this email already exists.'), { status: 409 });
  const hash = await bcrypt.hash(password, 10);
  const user = await insertOne('users', {
    name: name.trim(),
    email: em,
    phone: String(phone || '').trim(),
    password_hash: hash,
    role,
    status: 'active',
    referral_code: referralCode(),
    token_version: 0,
    permissions: {},
    two_factor_enabled: false,
  });
  await audit({ user_id: barAdmin, action: 'user_created', target_type: 'user', target_id: user.id, details: { role } });
  return publicUser(user);
}

export async function updateOwnProfile(user, { name, phone, bkash_number, nagad_number }) {
  const res = await col('users').findOneAndUpdate(
    { id: user.id },
    {
      $set: {
        name: String(name || user.name).trim(),
        phone: String(phone || user.phone || '').trim(),
        bkash_number: String(bkash_number || '').trim(),
        nagad_number: String(nagad_number || '').trim(),
        updated_at: new Date(),
      },
    },
    { returnDocument: 'after' },
  );
  return publicUser(res);
}

export async function changeOwnPassword(user, { current_password, new_password }) {
  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) throw Object.assign(new Error('Current password is incorrect.'), { status: 401 });
  if (!new_password || new_password.length < 8) throw Object.assign(new Error('New password must be at least 8 characters.'), { status: 422 });
  const hash = await bcrypt.hash(new_password, 10);
  await col('users').updateOne({ id: user.id }, { $inc: { token_version: 1 }, $set: { password_hash: hash } });
  await audit({ user_id: user.id, action: 'password_changed', target_type: 'user', target_id: user.id });
  return true;
}

export async function resetUserPassword(userId, newPassword, adminId) {
  if (!newPassword || String(newPassword).length < 8) throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 422 });
  const hash = await bcrypt.hash(String(newPassword), 10);
  const res = await col('users').findOneAndUpdate(
    { id: Number(userId) },
    { $inc: { token_version: 1 }, $set: { password_hash: hash } },
    { returnDocument: 'after' },
  );
  if (!res) throw Object.assign(new Error('User not found.'), { status: 404 });
  await notifyUser({ user_id: userId, type: 'account', title: 'Password reset', message: 'Your password was reset by an administrator.', email: true });
  await audit({ user_id: adminId, action: 'user_password_reset', target_type: 'user', target_id: userId });
  return true;
}

export async function pendingAgentStats() {
  const cursor = col('users').aggregate([
    { $match: { role: 'lead_agent' } },
    { $group: { _id: null, pending_agents: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, total_agents: { $sum: 1 } } },
  ]);
  const [doc] = await cursor.toArray();
  return { pending_agents: doc?.pending_agents || 0, total_agents: doc?.total_agents || 0 };
}