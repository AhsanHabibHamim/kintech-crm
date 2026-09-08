import { normalizeEmail, normalizePhone, isValidWhatsApp } from './helpers.js';

export const SERVICE_TAGS = ['Web Dev', 'App Dev', 'Design', 'Marketing'];

/** Lead form → service category dropdown. */
export const SERVICE_CATEGORIES = ['Web Dev', 'App Dev', 'Design', 'Digital Marketing', 'Other'];

/** Sub-services shown when category === 'Digital Marketing'. */
export const MARKETING_SUBSERVICES = [
  'SEO',
  'Google Ads / PPC',
  'Social Media Marketing',
  'Meta (FB/IG) Ads',
  'Content Creation',
  'Email Marketing',
  'Influencer Marketing',
  'Performance Marketing',
  'Local SEO / Maps',
  'YouTube Marketing',
];

/** Client niche dropdown — trending business categories. */
export const CLIENT_NICHES = [
  'Fashion & Clothing',
  'E-commerce / Online Store',
  'Restaurant & Café',
  'Real Estate',
  'Digital Agency',
  'Health & Beauty',
  'Spa & Salon',
  'Gym & Fitness',
  'Dental & Medical',
  'Legal / Law Firm',
  'Photography & Studio',
  'Education / Coaching',
  'Event & Wedding Planner',
  'Plumbing',
  'Electrician / AC Repair',
  'Home & Interior',
  'Construction / Contractor',
  'Automotive / Car Service',
  'Travel & Tourism',
  'Logistics & Courier',
  'Hotel & Hospitality',
  'Retail Shop',
  'Groceries & Supermarket',
  'Bakery & Sweets',
  'Jewelry & Accessories',
  'Pharmacy',
  'Electronics & Gadgets',
  'Furniture & Homeware',
  'Printing & Signage',
  'Agriculture & Farming',
  'Pets & Veterinary',
  'Startup / SaaS',
  'Individual Professional',
  'Other',
];
export const MAX_SOCIAL_LINKS = 10;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:[0-9]+)?(\/\S*)?$/i;

// Known disposable / throwaway email domains (curated subset).
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'tempmail.com',
  'tempmailo.com', 'temp-mail.org', 'throwaway.email', 'yopmail.com',
  'sharklasers.com', 'grr.la', 'dispostable.com', 'mailnesia.com',
  'trashmail.com', 'spamgourmet.com', 'getnada.com', 'tmpmail.org',
  'maildrop.cc', 'mailtemp.net', 'mytemp.email', 'fakemail.net',
]);

export function isDisposableEmail(email) {
  const domain = String(email).split('@')[1]?.toLowerCase() || '';
  return DISPOSABLE_DOMAINS.has(domain) || domain.includes('temp') || domain.endsWith('.tk');
}

/**
 * Spam-pattern heuristics used by the auto-validation engine.
 * Returns array of { code, message } flags.
 */
export function detectSpamPatterns({ client_name, email, whatsapp_number, website_url, location, social_links = [] }) {
  const flags = [];
  const name = String(client_name || '').trim();

  if (!name) flags.push({ code: 'empty_name', message: 'Client name is empty' });
  else if (/\d/.test(name)) flags.push({ code: 'name_has_digits', message: 'Client name contains digits' });
  else if (/[.]{2,}|[_]{2,}|[!@#$%^&*()]/.test(name)) flags.push({ code: 'name_weird_chars', message: 'Client name contains suspicious characters' });
  else if (/^(test|testing|fake|sample|anon|unknown|none)[a-z]*$/i.test(name)) flags.push({ code: 'test_name', message: 'Client name looks like a test/placeholder name' });
  else if (/(.)\1{4,}/.test(name.replace(/\s/g, ''))) flags.push({ code: 'name_repeated', message: 'Client name has suspicious repeated characters' });

  const em = normalizeEmail(email);
  if (!EMAIL_RE.test(em)) flags.push({ code: 'bad_email', message: 'Email format is invalid' });
  else if (isDisposableEmail(em)) flags.push({ code: 'disposable_email', message: 'Email uses a disposable/temporary provider' });

  const ph = normalizePhone(whatsapp_number);
  if (!ph) flags.push({ code: 'empty_phone', message: 'WhatsApp number is missing' });
  else if (!isValidWhatsApp(ph)) flags.push({ code: 'bad_phone', message: 'WhatsApp number format is invalid for supported countries' });
  else {
    const digits = ph.replace(/\D/g, '');
    const local = digits.startsWith('880') ? digits.slice(3) : digits;
    // e.g. '1111111111' (all same digit) — genuine spam marker.
    const allSame = /^(\d)\1{7,}$/.test(local);
    // e.g. '1999999999' — 9+ of one digit inside the number.
    const heavyRepeat = /(\d)\1{8}/.test(local);
    if (allSame || heavyRepeat) {
      flags.push({ code: 'phone_repeated', message: 'WhatsApp number consists of repeated digits' });
    }
  }

  if (website_url) {
    const w = String(website_url).trim();
    if (!URL_RE.test(w)) flags.push({ code: 'bad_url', message: 'Website URL format is invalid' });
    if (w.length > 300) flags.push({ code: 'url_too_long', message: 'Website URL is unreasonably long' });
  }

  if (Array.isArray(social_links)) {
    for (const raw of social_links) {
      const s = String(raw || '').trim();
      if (!s) continue;
      if (s.length > 300) { flags.push({ code: 'social_url_too_long', message: 'A social link is unreasonably long' }); break; }
      if (!URL_RE.test(s)) { flags.push({ code: 'bad_social_url', message: 'A social link URL format is invalid' }); break; }
    }
  }

  if (location && String(location).length > 200) {
    flags.push({ code: 'location_too_long', message: 'Location field is unreasonably long' });
  }

  return flags;
}

function phoneDigitsOnly(p) {
  return String(p).replace(/\D/g, '');
}

/**
 * Validate + normalize a raw lead submission payload.
 * Throws { status, message } on validation errors.
 */
export function sanitizeLeadInput(body) {
  const client_name = String(body.client_name || '').trim();
  const email = normalizeEmail(body.email || '');
  const whatsapp_number = normalizePhone(body.whatsapp_number || '');
  const website_url = String(body.website_url || '').trim();
  const location = String(body.location || '').trim();
  const service_interested_in = String(body.service_interested_in || '').trim();

  const category = String(body.category || '').trim();
  const client_niche = String(body.client_niche || '').trim();
  const sub_service = String(body.sub_service || '').trim();
  const optIn = (v, list) => { const s = String(v || '').trim(); return list.includes(s) ? s : ''; };
  const normalizedCategory = optIn(category, SERVICE_CATEGORIES);
  // client_niche is free-form ("Other" allowed) but capped; sub_service only valid within digital marketing
  const normalizedSubService = normalizedCategory === 'Digital Marketing' ? optIn(sub_service, MARKETING_SUBSERVICES) : '';

  let social_links = [];
  if (body.social_links !== undefined && body.social_links !== null) {
    const raw = Array.isArray(body.social_links) ? body.social_links : [body.social_links];
    social_links = raw
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  }

  const errors = [];
  if (client_name.length < 2 || client_name.length > 100) errors.push('Client name must be 2-100 characters.');
  if (!EMAIL_RE.test(email)) errors.push('A valid email address is required.');
  if (!isValidWhatsApp(whatsapp_number)) errors.push('A valid WhatsApp number (with country code) is required.');
  if (website_url && !URL_RE.test(website_url)) errors.push('Website URL is not a valid URL.');
  if (category && !SERVICE_CATEGORIES.includes(category)) errors.push('Please pick a valid service category.');
  if (client_niche && client_niche.length > 80) errors.push('Client niche must be under 80 characters.');
  if (social_links.length > MAX_SOCIAL_LINKS) errors.push(`You can add up to ${MAX_SOCIAL_LINKS} social links.`);
  for (const s of social_links) {
    if (s.length > 300) { errors.push('A social link is too long (max 300 characters).'); break; }
    if (!URL_RE.test(s)) { errors.push('Every social link must be a valid URL.'); break; }
  }
  if (location && location.length > 200) errors.push('Location must be under 200 characters.');
  if (service_interested_in.length < 2 || service_interested_in.length > 500) {
    errors.push('Please describe the service the client is interested in (2-500 characters).');
  }

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.status = 422;
    throw err;
  }

  return {
    client_name,
    email,
    whatsapp_number,
    website_url,
    social_links,
    location,
    service_interested_in,
    ...(normalizedCategory ? { category: normalizedCategory, sub_service: normalizedSubService } : {}),
    ...(client_niche ? { client_niche } : {}),
  };
}