import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', referral: '' });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api.post('/auth/register', { ...form, terms_accepted: terms });
      setDone(true);
      toast(data.message, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute w-[28rem] h-[28rem] rounded-full bg-emerald-500/15 blur-[130px] animate-aurora" />
        <div className="relative w-full max-w-md card !bg-white/95 p-8 text-center rounded-3xl shadow-glow-lg !border-white/40">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 grid place-items-center text-3xl shadow-glow mb-4 animate-floaty">📨</div>
          <h1 className="font-display text-xl font-extrabold text-slate-800 tracking-tight">Almost there!</h1>
          <p className="text-sm text-slate-500 mt-2">Your account is <b>pending admin approval</b>. You'll receive a notification once approved, then you can start submitting leads.</p>
          <Link to="/login" className="btn-primary w-full mt-6">Back to login</Link>
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8 bg-ink-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute -top-20 right-0 w-[26rem] h-[26rem] rounded-full bg-brand-600/20 blur-[130px] animate-aurora" />
      <div className="absolute bottom-0 -left-20 w-[26rem] h-[26rem] rounded-full bg-neon/12 blur-[130px] animate-aurora" style={{ animationDelay: '-6s' }} />
      <div className="relative w-full max-w-md card !bg-white/95 rounded-3xl shadow-glow-lg !border-white/40 p-7 sm:p-8 backdrop-blur-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-grad text-white grid place-items-center font-display font-extrabold text-xl mx-auto mb-3 shadow-glow">K</div>
          <h1 className="font-display text-2xl font-extrabold text-slate-800 tracking-tight">Become a Lead Agent</h1>
          <p className="text-sm text-slate-500 mt-1.5">Earn per verified lead + bonus on Super Leads</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <input className="input" placeholder="Full name" value={form.name} onChange={set('name')} autoFocus required />
          <input className="input" placeholder="Email" type="email" value={form.email} onChange={set('email')} required />
          <input className="input" placeholder="Phone (e.g. 017XXXXXXXX)" type="tel" value={form.phone} onChange={set('phone')} required />
          <input className="input" placeholder="Password (min 8 characters)" type="password" value={form.password} onChange={set('password')} required />
          <input className="input" placeholder="Referral code (optional)" value={form.referral} onChange={set('referral')} />
          <label className="flex items-start gap-2.5 text-sm text-slate-600">
            <input type="checkbox" className="mt-0.5 w-4 h-4" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
            <span>I accept the program terms: per-lead commission rate, payout thresholds (100 leads first, then every 50), and that only genuine leads are allowed.</span>
          </label>
          <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : 'Create account'}</button>
        </form>
        <div className="mt-5 text-sm text-center text-slate-500">
          Already have an account? <Link to="/login" className="glow-text font-semibold">Sign in</Link>
        </div>
      </div>
    </div>
  );
}