import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { Spinner, Field } from '../components/ui.jsx';
import { OFFLINE, isOnline, subscribeOnline } from '../utils/offline.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:[0-9]+)?(\/\S*)?$/i;
const PHONE_RE = /^\+?[0-9][0-9\s()-]{9,15}$/;
const MAX_SOCIAL_LINKS = 10;

const SERVICE_CATEGORIES = ['Web Dev', 'App Dev', 'Design', 'Digital Marketing', 'Other'];

const MARKETING_SUBSERVICES = [
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

const CLIENT_NICHES = [
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

export default function LeadForm({ onSubmitted, initial = null }) {
  const toast = useToast();
  const editing = !!initial;
  const [form, setForm] = useState(() =>
    initial
      ? {
          client_name: initial.client_name || '',
          email: initial.email || '',
          whatsapp_number: initial.whatsapp_number || '',
          website_url: initial.website_url || '',
          location: initial.location || '',
          service_interested_in: initial.service_interested_in || '',
          category: initial.category || '',
          sub_service: initial.sub_service || '',
          client_niche: initial.client_niche || '',
        }
      : {},
  );
  const nicheListed = initial?.client_niche && CLIENT_NICHES.includes(initial.client_niche);
  const [nicheOther, setNicheOther] = useState(nicheListed || !initial?.client_niche ? '' : initial.client_niche);
  const [social_links, setSocialLinks] = useState(() => (initial?.social_links?.length ? [...initial.social_links] : ['']));
  const [editNote, setEditNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState(null);
  const [online, setOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const timers = useRef({});

  useEffect(() => {
    setPendingCount(OFFLINE.list().length);
    const unsub = subscribeOnline((on) => {
      setOnline(on);
      setPendingCount(OFFLINE.list().length);
      if (on) syncQueue();
    });
    return unsub;
  }, []); // eslint-disable-line

  const syncQueue = useCallback(async () => {
    const queue = OFFLINE.list();
    if (!queue.length || syncing) return;
    setSyncing(true);
    for (const lead of [...queue]) {
      try {
        await api.post('/leads', lead);
        OFFLINE.remove(lead._id);
      } catch (e) {
        if (e.status === 409 || e.status === 422) OFFLINE.remove(lead._id);
      }
    }
    setSyncing(false);
    setPendingCount(OFFLINE.list().length);
    toast('Offline leads synced.', 'success');
    onSubmitted && onSubmitted();
  }, [syncing, toast, onSubmitted]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setSocial(idx, v) {
    setSocialLinks((arr) => arr.map((x, i) => (i === idx ? v : x)));
    setError('');
  }
  function addSocial() {
    if (social_links.length >= MAX_SOCIAL_LINKS) {
      toast(`Up to ${MAX_SOCIAL_LINKS} social links allowed.`, 'error');
      return;
    }
    setSocialLinks((arr) => [...arr, '']);
  }
  function removeSocial(idx) {
    setSocialLinks((arr) => arr.filter((_, i) => i !== idx));
  }

  // Debounced real-time duplicate check on email + whatsapp.
  const checkDup = useCallback((k, v) => {
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(async () => {
      if (v.length < 8) { setDup(null); return; }
      try {
        const data = await api.get('/leads/check-duplicate?email=' + encodeURIComponent(form.email || '') + '&whatsapp=' + encodeURIComponent(form.whatsapp_number || '') + (initial ? `&exclude=${initial.id}` : ''));
        setDup(data);
      } catch { /* ignore */ }
    }, 450);
  }, [form.email, form.whatsapp_number]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const name = String(form.client_name || '').trim();
    const email = String(form.email || '').trim();
    const phone = String(form.whatsapp_number || '').trim();
    const website = String(form.website_url || '').trim();
    const location = String(form.location || '').trim();
    const note = String(form.service_interested_in || '').trim();
    const category = String(form.category || '').trim();
    const sub_service = String(form.sub_service || '').trim();
    const niche = String(form.client_niche || '').trim();
    const links = social_links.map((s) => s.trim()).filter(Boolean);

    if (name.length < 2) return 'Client name is required (min 2 characters).';
    if (!EMAIL_RE.test(email)) return 'A valid client email address is required.';
    if (!PHONE_RE.test(phone)) return 'WhatsApp number is required (10-16 digits, with country code).';
    if (!SERVICE_CATEGORIES.includes(category)) return 'Please select the service category (Web Dev, Digital Marketing, Design…).';
    if (category === 'Digital Marketing' && !MARKETING_SUBSERVICES.includes(sub_service)) return 'Please select the digital marketing service (SEO, Google Ads, SMM…).';
    if (!niche) return 'Please select the client niche (fashion, dental, spa, restaurant…).';
    if (niche === 'Other' && !String(nicheOther || '').trim()) return 'Please type the client niche.';
    if (website && !URL_RE.test(website)) return 'Main website must be a valid URL.';
    if (links.length > MAX_SOCIAL_LINKS) return `Up to ${MAX_SOCIAL_LINKS} social links allowed.`;
    for (const l of links) if (!URL_RE.test(l)) return `"${l}" is not a valid URL.`;
    if (!location) return 'Client location is required (city or area).';
    if (note.length < 2) return 'Please describe the service the client is interested in.';
    if (note.length > 500) return 'Service note must be under 500 characters.';
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (editing && !isOnline()) {
      toast('You need to be online to edit a lead.', 'error');
      return;
    }
    const problem = validate();
    if (problem) { setError(problem); toast(problem, 'error'); return; }
    if (dup && (dup.email_taken || dup.whatsapp_taken)) {
      toast('Duplicate detected — this email or WhatsApp is already submitted.', 'error');
      return;
    }
    const niche = String(form.client_niche || '').trim();
    const category = String(form.category || '').trim();
    const payload = {
      client_name: String(form.client_name).trim(),
      email: String(form.email).trim(),
      whatsapp_number: String(form.whatsapp_number).trim(),
      website_url: String(form.website_url || '').trim(),
      social_links: social_links.map((s) => s.trim()).filter(Boolean),
      location: String(form.location).trim(),
      service_interested_in: String(form.service_interested_in).trim(),
      category,
      client_niche: niche === 'Other' ? String(nicheOther || '').trim() : niche,
      ...(category === 'Digital Marketing' ? { sub_service: String(form.sub_service || '').trim() } : {}),
    };
    if (!editing && !online) {
      OFFLINE.push(payload);
      setPendingCount(OFFLINE.list().length);
      reset();
      toast('You are offline. Lead saved — will sync automatically when you are back online.', 'success');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/leads/${initial.id}`, { ...payload, note: editNote.trim() });
        toast('Lead updated — resubmitted for review.', 'success');
      } else {
        await api.post('/leads', payload);
        toast('Lead submitted! It is now being validated.', 'success');
      }
      reset();
      setDup(null);
      onSubmitted && onSubmitted();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm({});
    setSocialLinks(['']);
    setError('');
    setEditNote('');
    setNicheOther('');
  }

  const input = 'input !py-3 text-[16px]'; // large tap targets, no iOS zoom
  const addMore = social_links.filter((s) => s.trim()).length >= 1;

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off" noValidate>
      {editing && (
        <div className="bg-brand-50 border border-brand-200 text-brand-800 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span>✎ Editing lead #{initial.id} — saving resubmits it for review.</span>
        </div>
      )}

      {editing && (
        <Field label="Resubmission note (optional)" hint="Tell the reviewer what you fixed — shown to admin/manager.">
          <textarea className="input !py-3 !h-20 text-[16px] resize-y" placeholder="e.g. Corrected the client website URL and added their LinkedIn profile." value={editNote} onChange={(e) => setEditNote(e.target.value)} maxLength={500} />
        </Field>
      )}
      {!online && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          <span>📴 Offline mode — leads are saved locally.</span>
          {pendingCount > 0 && <button type="button" className="font-bold underline" onClick={syncQueue}>Sync {pendingCount} now</button>}
        </div>
      )}
      {online && pendingCount > 0 && (
        <div className="bg-brand-50 border border-brand-200 text-brand-800 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          <span>🔄 {pendingCount} offline lead(s) pending sync.</span>
          <button type="button" className="btn-soft !px-3 !py-1.5" onClick={syncQueue} disabled={syncing}>{syncing ? <Spinner className="w-4 h-4" /> : 'Sync now'}</button>
        </div>
      )}

      {dup && (dup.email_taken || dup.whatsapp_taken) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
          ⚠️ Duplicate lead detected — {dup.email_taken ? 'this email' : 'this WhatsApp number'} is already in the system
          {dup.duplicate?.same_agent ? ' (submitted by you)' : ' (submitted by another agent)'}.
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
          🚩 {error}
        </div>
      )}

      <Field label="1 · Client name">
        <input className={input} placeholder="e.g. Rahim Traders" value={form.client_name || ''} onChange={(e) => { set('client_name', e.target.value); setError(''); }} required maxLength={100} />
      </Field>

      <Field label="2 · Client email">
        <input className={input} type="email" inputMode="email" placeholder="client@company.com" value={form.email || ''} onChange={(e) => { set('email', e.target.value); setError(''); checkDup('email', e.target.value); }} required />
      </Field>

      <Field label="3 · WhatsApp number">
        <input className={input} type="tel" inputMode="tel" placeholder="+8801XXXXXXXXX" value={form.whatsapp_number || ''} onChange={(e) => { set('whatsapp_number', e.target.value); setError(''); checkDup('whatsapp', e.target.value); }} required />
      </Field>

      <Field label="4 · Service category">
        <select className={input} value={form.category || ''} onChange={(e) => { set('category', e.target.value); set('sub_service', ''); setError(''); }} required>
          <option value="" disabled>Select category…</option>
          {SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>

      {form.category === 'Digital Marketing' && (
        <Field label="5 · Digital marketing service">
          <select className={input} value={form.sub_service || ''} onChange={(e) => { set('sub_service', e.target.value); setError(''); }} required>
            <option value="" disabled>Select service…</option>
            {MARKETING_SUBSERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      )}

      <Field label={form.category === 'Digital Marketing' ? '6 · Client niche' : '5 · Client niche'} hint="Select the client's business type (fashion, spa, dental, restaurant, etc.).">
        <select className={input} value={form.client_niche || ''} onChange={(e) => { set('client_niche', e.target.value); setError(''); }} required>
          <option value="" disabled>Select client business…</option>
          {CLIENT_NICHES.map((n) => <option key={n}>{n}</option>)}
        </select>
      </Field>

      {form.client_niche === 'Other' && (
        <Field label={form.category === 'Digital Marketing' ? '7 · Specify niche' : '6 · Specify niche'}>
          <input className={input} placeholder="e.g. Laundry & dry cleaning" value={nicheOther} onChange={(e) => { setNicheOther(e.target.value); setError(''); }} maxLength={80} required />
        </Field>
      )}

      <Field label={form.client_niche === 'Other' ? '7 · Main website (optional)' : (form.category === 'Digital Marketing' ? '7 · Main website (optional)' : '6 · Main website (optional)')}>
        <input className={input} type="url" inputMode="url" placeholder="https://company.com" value={form.website_url || ''} onChange={(e) => { set('website_url', e.target.value); setError(''); }} />
      </Field>

      <Field label={`${form.client_niche === 'Other' ? '8' : (form.category === 'Digital Marketing' ? '8' : '7')} · Social links (${social_links.filter((s) => s.trim()).length}/${MAX_SOCIAL_LINKS})`} hint="Facebook, Instagram, LinkedIn, YouTube… add as many as the client has.">
        <div className="space-y-2">
          {social_links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={input}
                type="url"
                inputMode="url"
                placeholder="https://facebook.com/clientprofile"
                value={link}
                onChange={(e) => setSocial(i, e.target.value)}
              />
              <button type="button" className="btn-ghost !px-3 shrink-0" onClick={() => removeSocial(i)} aria-label="Remove link">✕</button>
            </div>
          ))}
          <button type="button" className="btn-soft !py-2 w-full text-sm" onClick={addSocial}>
            {addMore ? '+ Add another link' : '+ Add a social link'}
          </button>
        </div>
      </Field>

      <Field label={form.client_niche === 'Other' ? '9 · Location' : (form.category === 'Digital Marketing' ? '9 · Location' : '8 · Location')}>
        <input className={input} placeholder="e.g. Dhaka, Bangladesh" value={form.location || ''} onChange={(e) => { set('location', e.target.value); setError(''); }} required />
      </Field>

      <Field label={form.client_niche === 'Other' ? '10 · Service the client is interested in' : (form.category === 'Digital Marketing' ? '10 · Service the client is interested in' : '9 · Service the client is interested in')} hint="Free note: which service they need (web/app/design/marketing) or the proposal you sent them.">
        <textarea className="input !py-3 !h-24 text-[16px] resize-y" placeholder="e.g. Client wants a full e-commerce website with COD — I shared the web dev proposal today." value={form.service_interested_in || ''} onChange={(e) => { set('service_interested_in', e.target.value); setError(''); }} required maxLength={500} />
      </Field>

      <button className="btn-primary w-full !py-3.5 text-base" disabled={busy}>
        {busy ? <Spinner className="w-5 h-5" /> : editing ? '✎ Save changes & resubmit' : '🚀 Submit lead'}
      </button>
    </form>
  );
}