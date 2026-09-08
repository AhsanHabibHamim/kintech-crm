import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;
let smtpConfigured = false;

if (config.mail.host) {
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  smtpConfigured = true;
}

/**
 * Send an email. In production without SMTP configured this is a no-op that logs.
 * Never throws — callers should catch failures gracefully.
 */
export async function sendEmail({ to, subject, text, html }) {
  if (!smtpConfigured) {
    console.log(`[mail:dev] to=${to} subject="${subject}" body="${String(text || html || '').slice(0, 200)}"`);
    return { skipped: true };
  }
  try {
    await transporter.sendMail({
      from: config.mail.from,
      to,
      subject,
      text,
      html,
    });
    return { skipped: false };
  } catch (e) {
    console.error('[mail] send failed:', e.message);
    throw e;
  }
}

/** Optional SMS / WhatsApp API hook — fires only if configured. */
export async function sendSms({ to, text }) {
  if (!config.sms.apiUrl || !config.sms.apiKey) return { skipped: true };
  try {
    const res = await fetch(config.sms.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sms.apiKey}` },
      body: JSON.stringify({ to, text, sender: config.sms.sender }),
    });
    return { ok: res.ok };
  } catch (e) {
    console.error('[sms] send failed:', e.message);
    return { ok: false };
  }
}