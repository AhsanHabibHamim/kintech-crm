import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { config } from '../config.js';
import { col, insertOne } from '../db/mongodb.js';
import { normalizeEmail, referralCode, publicUser } from '../utils/helpers.js';
import { isDisposableEmail } from '../utils/validators.js';

const ROLES = ['super_admin', 'manager', 'lead_agent'];

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email, ver: user.token_version || 0 },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpires },
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh', ver: user.token_version || 0 },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpires },
  );
}

function signTemp(user) {
  return jwt.sign(
    { sub: user.id, purpose: '2fa' },
    config.jwt.secret,
    { expiresIn: '10m' },
  );
}

export async function registerAgent({ name, email, phone, password, referral, termsAccepted }) {
  const em = normalizeEmail(email);
  const exists = await col('users').findOne({ email: em });
  if (exists) {
    const e = new Error('An account with this email already exists.');
    e.status = 409;
    throw e;
  }
  if (name.trim().length < 2) {
    const e = new Error('Full name is required.');
    e.status = 422;
    throw e;
  }
  if (isDisposableEmail(em)) {
    const e = new Error('Please use a real email address — temporary emails are not allowed.');
    e.status = 422;
    throw e;
  }
  if (password.length < 8) {
    const e = new Error('Password must be at least 8 characters.');
    e.status = 422;
    throw e;
  }
  if (!termsAccepted) {
    const e = new Error('You must accept the program terms to sign up.');
    e.status = 422;
    throw e;
  }

  let referredBy = null;
  if (referral) {
    const ref = String(referral).trim().toLowerCase();
    const refUser = await col('users').findOne({ referral_code: new RegExp('^' + ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
    if (refUser) referredBy = refUser.id;
  }

  const code = referralCode();
  const hash = await bcrypt.hash(password, 10);
  const user = await insertOne('users', {
    name: name.trim(),
    email: em,
    phone: String(phone || '').trim(),
    password_hash: hash,
    role: 'lead_agent',
    status: 'pending',
    referral_code: code,
    referred_by: referredBy,
    token_version: 0,
    terms_accepted: true,
    terms_accepted_at: new Date(),
  });
  return publicUser(user);
}

export async function findUserById(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return col('users').findOne({ id: n });
}

export async function login({ email, password }) {
  const em = normalizeEmail(email);
  const user = await col('users').findOne({ email: em });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const e = new Error('Invalid email or password.');
    e.status = 401;
    throw e;
  }
  if (user.status === 'suspended') {
    const e = new Error('This account is suspended. Contact support.');
    e.status = 403;
    throw e;
  }
  if (user.status === 'pending') {
    const e = new Error('Your account is awaiting admin approval. You will be able to log in once approved.');
    e.status = 403;
    throw e;
  }

  if (user.two_factor_enabled) {
    return { require_2fa: true, temp_token: signTemp(user), user: publicUser(user) };
  }
  return { access_token: signAccess(user), refresh_token: signRefresh(user), user: publicUser(user) };
}

export async function verify2fa({ temp_token, code }) {
  let payload;
  try {
    payload = jwt.verify(temp_token, config.jwt.secret);
  } catch {
    const e = new Error('2FA session expired. Please log in again.');
    e.status = 401;
    throw e;
  }
  if (payload.purpose !== '2fa') {
    const e = new Error('Invalid 2FA token');
    e.status = 401;
    throw e;
  }
  const user = await findUserById(payload.sub);
  if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
    const e = new Error('2FA is not enabled for this account.');
    e.status = 400;
    throw e;
  }
  const valid = authenticator.check(String(code), user.two_factor_secret);
  if (!valid) {
    const e = new Error('Invalid one-time code.');
    e.status = 401;
    throw e;
  }
  return { access_token: signAccess(user), refresh_token: signRefresh(user), user: publicUser(user) };
}

export async function generateTotpSetup(user) {
  const secret = authenticator.generateSecret();
  await col('users').updateOne({ id: user.id }, { $set: { two_factor_secret: secret } });
  const otpauth = authenticator.keyuri(user.email, config.totpIssuer, secret);
  const qr = await new Promise((resolve, reject) => {
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(otpauth, (err, url) => (err ? reject(err) : resolve(url))),
    );
  });
  return { secret, otpauth, qr };
}

export async function enable2fa(user, code) {
  if (!user.two_factor_secret) {
    const e = new Error('Start the 2FA setup first.');
    e.status = 400;
    throw e;
  }
  if (!authenticator.check(String(code), user.two_factor_secret)) {
    const e = new Error('Invalid one-time code.');
    e.status = 401;
    throw e;
  }
  await col('users').updateOne({ id: user.id }, { $set: { two_factor_enabled: true } });
  return true;
}

export async function disable2fa(user, code) {
  if (!user.two_factor_enabled || !user.two_factor_secret) {
    const e = new Error('2FA is not enabled.');
    e.status = 400;
    throw e;
  }
  if (!authenticator.check(String(code), user.two_factor_secret)) {
    const e = new Error('Invalid one-time code.');
    e.status = 401;
    throw e;
  }
  await col('users').updateOne({ id: user.id }, { $set: { two_factor_enabled: false, two_factor_secret: '' } });
  return true;
}

export function refreshTokens(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    const e = new Error('Session expired. Please log in again.');
    e.status = 401;
    throw e;
  }
  if (payload.type !== 'refresh') {
    const e = new Error('Invalid refresh token.');
    e.status = 401;
    throw e;
  }
  return findUserById(payload.sub).then((user) => {
    if (!user || user.token_version !== (payload.ver || 0)) {
      const e = new Error('Session revoked. Please log in again.');
      e.status = 401;
      throw e;
    }
    return { access_token: signAccess(user), refresh_token: signRefresh(user), user: publicUser(user) };
  });
}

export function issueTokens(user) {
  return { access_token: signAccess(user), refresh_token: signRefresh(user) };
}

export async function invalidateSessions(userId) {
  await col('users').updateOne({ id: Number(userId) }, { $inc: { token_version: 1 } });
}

export { ROLES };