import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { findUserById } from '../services/authService.js';

/** Verify Bearer access token; attaches req.user. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }

  const user = await findUserById(payload.sub);
  if (!user) return res.status(401).json({ message: 'Account not found.' });
  if (user.token_version !== (payload.ver || 0)) {
    return res.status(401).json({ message: 'Session revoked. Please log in again.' });
  }
  req.user = user;
  next();
}

/** Ensure account is usable (not suspended or pending approval). `approved` is a legacy alias for active. */
export function requireActive(req, res, next) {
  if (!['active', 'approved'].includes(req.user.status)) {
    return res.status(403).json({ message: 'Your account is not active. Contact support.' });
  }
  next();
}

/** Enforce 2FA for privileged roles (admin / manager). */
export function require2fa(req, res, next) {
  if (['super_admin', 'manager'].includes(req.user.role) && !req.user.two_factor_enabled) {
    return res.status(403).json({
      message: 'Two-factor authentication must be enabled to access the dashboard.',
      require_2fa_setup: true,
    });
  }
  next();
}

// ---- RBAC helpers ----

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

const ROLE_RANK = { lead_agent: 0, manager: 1, super_admin: 2 };

export function requireRank(minRank) {
  return (req, res, next) => {
    const rank = ROLE_RANK[req.user?.role] ?? -1;
    if (rank < minRank) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

/** Manager grantable permission check (e.g. manage_rates, manage_payouts, manage_users). */
export function can(permission) {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    const perms = req.user.permissions || {};
    if (perms[permission] === true) return next();
    return res.status(403).json({ message: `This action requires the "${permission}" permission.` });
  };
}