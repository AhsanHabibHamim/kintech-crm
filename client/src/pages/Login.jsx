import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { setAccessToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function onLogin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      if (data.require_2fa) {
        sessionStorage.setItem('kt_2fa_temp', data.temp_token);
        navigate('/2fa-verify');
        return;
      }
      setAccessToken(data.access_token);
      localStorage.setItem('kt_refresh', data.refresh_token);
      setUser(data.user);
      const target = data.user.role === 'super_admin' ? '/admin' : data.user.role === 'manager' ? '/manager' : '/agent';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 bg-ink-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute top-0 -left-20 w-[26rem] h-[26rem] rounded-full bg-brand-600/20 blur-[130px] animate-aurora" />
      <div className="absolute bottom-0 -right-20 w-[26rem] h-[26rem] rounded-full bg-neon/15 blur-[130px] animate-aurora" style={{ animationDelay: '-7s' }} />
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <div className="relative w-full max-w-md card !bg-white/95 rounded-3xl shadow-glow-lg !border-white/40 p-7 sm:p-9 backdrop-blur-2xl">
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-brand-grad text-white grid place-items-center font-display font-extrabold text-2xl mx-auto mb-4 shadow-glow-lg animate-floaty">K</div>
          <h1 className="font-display text-2xl font-extrabold text-slate-800 tracking-tight">KinTech CRM</h1>
          <p className="text-sm text-slate-500 mt-1.5">Lead Generation Portal</p>
        </div>
        <form onSubmit={onLogin} className="space-y-4">
          {error && <div className="text-sm bg-rose-50 text-rose-600 rounded-xl px-3.5 py-2.5 border border-rose-100">{error}</div>}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn-primary w-full !py-3 text-[15px]" disabled={busy}>
            {busy ? <Spinner className="w-4 h-4" /> : 'Sign in →'}
          </button>
        </form>
        <div className="mt-5 text-center text-sm text-slate-500">
          New agent? <Link to="/register" className="glow-text font-semibold hover:underline">Request an account</Link>
        </div>
      </div>

      <p className="relative text-slate-500/70 text-xs mt-6 font-mono tracking-wider">crm.kintechagency.com</p>
    </div>
  );
}