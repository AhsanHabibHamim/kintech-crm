import { useRef, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { Spinner } from '../components/ui.jsx';

/** TOTP enrollment: generate secret + QR, verify code, enable; then refresh session. */
export default function TwoFactorSetup() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [err, setErr] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.post('/auth/2fa/setup').then((s) => setSetup(s)).catch((e) => { setErr(e.message); toast(e.message, 'error'); });
  }, []); // eslint-disable-line

  async function enable(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/2fa/enable', { code });
      setEnabled(true);
      toast('Two-factor authentication enabled.', 'success');
    } catch (err) {
      setErr(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute w-[28rem] h-[28rem] rounded-full bg-emerald-500/15 blur-[130px] animate-aurora" />
        <div className="relative max-w-md w-full text-center card !bg-ink-800/70 !border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-glow-lg">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 grid place-items-center text-3xl shadow-glow animate-floaty mb-4">✅</div>
          <h1 className="font-display text-xl font-extrabold text-white">2FA enabled</h1>
          <p className="text-slate-400 text-sm mt-2">Your account is now protected. Future logins require your authenticator code.</p>
          <Link to="/login" className="btn-primary w-full mt-6" onClick={() => { logout(); }}>Log in again</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-ink-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute -top-20 right-0 w-[26rem] h-[26rem] rounded-full bg-brand-600/20 blur-[130px] animate-aurora" />
      <div className="absolute bottom-0 -left-20 w-[26rem] h-[26rem] rounded-full bg-neon/12 blur-[130px] animate-aurora" style={{ animationDelay: '-6s' }} />
      <div className="relative w-full max-w-lg card !bg-white/95 rounded-3xl shadow-glow-lg !border-white/40 overflow-hidden backdrop-blur-2xl">
        <div className="relative bg-ink-900 text-white px-7 py-6">
          <div className="absolute inset-0 bg-mesh opacity-60" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-grad grid place-items-center text-2xl shadow-glow">🔐</div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight">Two-Factor Authentication</h1>
              <p className="text-slate-400 text-sm mt-0.5">Required for {user?.name} — use any authenticator app (Google Authenticator / Authy).</p>
            </div>
          </div>
        </div>
        <div className="p-7">
          {err && <div className="mb-4 text-sm bg-rose-50 text-rose-600 rounded-xl px-3.5 py-2.5 border border-rose-100">{err}</div>}
          {!setup ? (
            <div className="flex items-center justify-center py-10"><Spinner className="w-7 h-7 text-brand-600" /><span className="ml-3 text-sm text-slate-500">Generating secret…</span></div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <img src={setup.qr} alt="QR code" className="w-44 h-44 rounded-xl border border-slate-200 p-1 bg-white" />
                <div className="text-sm text-slate-600">
                  <p>1. Scan the QR code with your authenticator app.</p>
                  <p className="mt-2">2. Enter the 6-digit code below.</p>
                  <p className="mt-3 text-xs text-slate-400">Manual key: <code className="select-all bg-slate-100 rounded px-1.5 py-0.5 font-mono text-brand-700">{setup.secret}</code></p>
                </div>
              </div>
              <form onSubmit={enable} className="space-y-3">
                <input className="input text-center text-2xl tracking-[0.4em] font-mono max-w-52" maxLength={6} inputMode="numeric" pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
                <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? <Spinner className="w-4 h-4" /> : 'Verify & enable 2FA'}</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}