import { config } from '../config.js';
import { detectSpamPatterns, EMAIL_RE } from '../utils/validators.js';
import { isValidWhatsApp, normalizePhone, phoneDigits } from '../utils/helpers.js';

/**
 * Pure auto-validation logic (kept free of DB/queue side effects so it is unit-testable).
 * Returns { tag, notes } where tag ∈ likely_valid | likely_invalid | needs_review.
 */
export async function runAutoValidation({ client_name, email, whatsapp_number, website_url, location, social_links = [] }) {
  const notes = { spam: [] };

  // 1) Basic format + spam heuristics.
  const spamFlags = detectSpamPatterns({ client_name, email, whatsapp_number, website_url, location, social_links });
  notes.spam = spamFlags;
  const spamCodes = spamFlags.map((f) => f.code);

  const hardInvalid = [
    'empty_name', 'bad_email', 'disposable_email', 'empty_phone',
    'bad_phone', 'phone_repeated', 'test_name', 'name_repeated',
  ].some((c) => spamCodes.includes(c));
  const badFormatUrl = spamCodes.includes('bad_url') || spamCodes.includes('url_too_long') || spamCodes.includes('bad_social_url') || spamCodes.includes('social_url_too_long');

  // 2) Website reachability check.
  let urlStatus = null;
  if (website_url) {
    urlStatus = await checkWebsite(String(website_url));
    notes.website_check = urlStatus;
  }

  // 3) WhatsApp format + country validation.
  const ph = normalizePhone(whatsapp_number);
  notes.whatsapp_check = {
    valid: isValidWhatsApp(ph),
    digits: phoneDigits(ph),
    note: isValidWhatsApp(ph) ? 'Format looks valid' : 'Invalid or unsupported number format',
  };

  // 4) Location geocoding check.
  let locationStatus = null;
  if (location) {
    locationStatus = await geocodeLocation(String(location));
    notes.location_check = locationStatus;
  }

  // 5) Decide tag.
  let tag = 'likely_valid';
  const reasons = [];
  if (hardInvalid) {
    tag = 'likely_invalid';
    reasons.push(spamFlags.map((f) => f.message).join('; '));
  } else if (urlStatus && urlStatus.ok === false && locationStatus && locationStatus.ok === false) {
    tag = 'likely_invalid';
    reasons.push('Website is unreachable and location could not be verified.');
  } else if ((urlStatus && urlStatus.ok === false) || (locationStatus && locationStatus.ok === false)) {
    tag = 'needs_review';
    reasons.push(urlStatus && urlStatus.ok === false ? 'Website unreachable' : '');
    reasons.push(locationStatus && locationStatus.ok === false ? 'Location unverifiable' : '');
  } else if (badFormatUrl) {
    tag = 'needs_review';
    reasons.push('Website URL looks malformed.');
  } else if (spamCodes.length) {
    tag = 'needs_review';
    reasons.push(spamFlags.map((f) => f.message).join('; '));
  }

  notes.summary = reasons.filter(Boolean).join(' ');
  notes.tag_reasons = reasons.filter(Boolean);
  return { tag, notes };
}

async function checkWebsite(rawUrl) {
  let url = String(rawUrl).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.validation.urlTimeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'KinTechCRM/AutoValidator/1.0' }, timeout: config.validation.urlTimeoutMs });
    const okCode = res.status >= 200 && res.status <= 399;
    if (okCode) {
      return { ok: true, status: res.status, url, note: `Reachable (HTTP ${res.status})` };
    }
    return { ok: false, status: res.status, url, note: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: null, url, note: 'Unreachable or timeout: ' + e.message.slice(0, 60) };
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeLocation(location) {
  try {
    const params = new URLSearchParams({ q: String(location), format: 'json', limit: '1' });
    const res = await fetch(`${config.validation.geocodingApiUrl}?${params.toString()}`, {
      headers: { 'User-Agent': 'KinTechCRM/AutoValidator/1.0' },
      timeout: config.validation.urlTimeoutMs,
    });
    if (!res.ok) return { ok: null, note: `Geocoder HTTP ${res.status}` };
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      const place = data[0];
      const recognized = ['city', 'town', 'village'].includes(place.type) || place.address?.country;
      return { ok: !!recognized, found: true, label: place.display_name, place_type: place.type, note: recognized ? 'Location recognized' : 'Location found but type is unusual' };
    }
    return { ok: false, found: false, note: 'Location not found in geocoder' };
  } catch (e) {
    return { ok: null, note: 'Geocoder error: ' + e.message.slice(0, 60) };
  }
}

export const validEmail = (e) => EMAIL_RE.test(String(e || ''));