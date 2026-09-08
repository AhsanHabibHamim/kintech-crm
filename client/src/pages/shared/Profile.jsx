import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { api } from '../../api/client.js';
import { PageTitle, Spinner, Field } from '../../components/ui.jsx';
import { dateFmt } from '../../utils/format.js';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    bkash_number: user?.bkash_number || '',
    nagad_number: user?.nagad_number || '',
  });
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const refLink = user?.referral_code ? `${location.origin}/register?ref=${user.referral_code}` : null;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: u } = await api.patch('/profile/me', form);
      setUser(u);
      toast('Profile updated.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) { toast('Passwords do not match.', 'error'); return; }
    setPwBusy(true);
    try {
      await api.post('/profile/me/password', { current_password: pw.current_password, new_password: pw.new_password });
      toast('Password changed. Logging you out…', 'success');
      setTimeout(logout, 1200);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPwBusy(false);
    }
  }

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(refLink);
      toast('Referral link copied.', 'success');
    } catch { toast('Could not copy.', 'error'); }
  }

  return (
    <div className="space-y-5">
      <PageTitle title="Profile" sub="Manage your account and payout wallet details." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-800">👤 Personal details</h3>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className={`badge ${user?.role === 'admin' ? 'bg-rose-100 text-rose-700' : user?.role === 'manager' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{user?.role}</span>
            <span>Joined {dateFmt(user?.created_at)}</span>
          </div>
          <form onSubmit={save} className="space-y-4">
            <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="bKash number"><input className="input" inputMode="numeric" value={form.bkash_number} onChange={(e) => setForm({ ...form, bkash_number: e.target.value })} placeholder="For payouts" /></Field>
              <Field label="Nagad number"><input className="input" inputMode="numeric" value={form.nagad_number} onChange={(e) => setForm({ ...form, nagad_number: e.target.value })} placeholder="For payouts" /></Field>
            </div>
            <button className="btn-primary" disabled={busy}>{busy ? <Spinner className="w-4 h-4" /> : 'Save changes'}</button>
          </form>
        </div>

        {refLink && (
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-slate-800">🔗 Referral program</h3>
            <p className="text-sm text-slate-500">Invite agents with your link. You earn <b>5% of their per-lead commission</b> on their first 50 approved leads.</p>
            <div className="flex gap-2">
              <input className="input text-xs flex-1" readOnly value={refLink} onFocus={(e) => e.target.select()} />
              <button className="btn-soft" onClick={copyRef}>Copy</button>
            </div>
            <div className="p-4 bg-brand-50 rounded-xl text-sm text-brand-700">
              <b>Your code:</b> <code className="font-mono">{user.referral_code}</code>
            </div>
          </div>
        )}

        <div className="card p-5 space-y-4 lg:col-span-2">
          <h3 className="font-bold text-slate-800">🔒 Change password</h3>
          <form onSubmit={changePassword} className="grid sm:grid-cols-3 gap-4">
            <Field label="Current password"><input className="input" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>
            <Field label="New password"><input className="input" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required minLength={6} /></Field>
            <Field label="Confirm new password"><input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
            <div>
              <button className="btn-ghost" disabled={pwBusy}>{pwBusy ? <Spinner className="w-4 h-4" /> : 'Update password'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}