import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { Spinner } from '../components/ui.jsx';

export default function TwoFactorVerify() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    const temp_token = sessionStorage.getItem('kt_2fa_temp');
    try {
      const data = await api.post('/auth/2fa/verify', { temp_token, code });
      setAccessToken(data.access_token);
      localStorage.setItem('kt_refresh', data.refresh_token);
      sessionStorage.removeItem('kt_2fa_temp');
      setUser(data.user);
      const target = data.user.role === 'super_admin' ? '/admin' : data.user.role === 'manager' ? '/manager' : '/agent';
      navigate(target, { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-ink-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-brand-600/20 blur-[130px] animate-aurora" />
      <div className="relative w-full max-w-sm card !bg-white/95 rounded-3xl shadow-glow-lg !border-white/40 p-7 text-center backdrop-blur-2xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-grad grid place-items-center text-3xl shadow-glow-lg mb-4 animate-floaty">🔐</div>
        <h1 className="font-display text-xl font-extrabold text-slate-800 tracking-tight">Two-factor check</h1>
        <p className="text-sm text-slate-500 mt-1.5">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={verify} className="space-y-4 mt-6">
          <input className="input text-center text-2xl tracking-[0.4em] font-mono" maxLength={6} inputMode="numeric" pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required />
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? <Spinner className="w-4 h-4" /> : 'Verify'}</button>
        </form>
      </div>
    </div>
  );
}