import crypto from 'node:crypto';

export function referralCode(len = 8) {
  return crypto.randomBytes(len).toString('hex').slice(0, len).toUpperCase();
}

export function nowIso() {
  return new Date().toISOString();
}

export function publicUser(u) {
  const { password_hash, two_factor_secret, ...rest } = u;
  return rest;
}

export function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

export function fingerprintParts(ip, ua) {
  return `${ip}|${ua || ''}`;
}

/** Normalize an email for duplicate detection: lowercase, trim, strip mailto. */
export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .replace(/^mailto:/i, '')
    .replace(/^"|"$/g, '');
}

/**
 * Normalize a phone / WhatsApp number into E.164-ish format.
 * Handles: leading zeros, leading 00, bare 11-digit Bangladeshi numbers, spaces/dashes.
 */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('1')) d = '880' + d;
  if (d.length === 11 && d.startsWith('0')) d = '880' + d.slice(1);
  if (d.length <= 8) return '';
  return '+' + d;
}

/** Strip the leading '+' if present for storage-free compare. */
export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function isValidWhatsApp(phone) {
  const d = phoneDigits(phone);
  if (d.length < 10 || d.length > 15) return false;
  // Numbers carrying the Bangladesh country code must be genuine BD mobiles.
  if (d.startsWith('880') && d.length >= 12) {
    return /^880(17|18|16|19|15|13|14)\d{8}$/.test(d);
  }
  // Other markets — accept general E.164-ish numbers to avoid false rejects.
  return /^[1-9]\d{9,14}$/.test(d);
}

export function paginate({ page = 1, limit = 25 }) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
  return { offset: (p - 1) * l, limit: l, page: p };
}

export function clampNum(v, [min, max]) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}