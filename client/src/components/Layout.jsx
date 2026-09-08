import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { timeAgo, initials } from '../utils/format.js';
import { Spinner } from './ui.jsx';

const ICONS = {
  home: '🏠', leads: '📋', submit: '➕', earnings: '💰', payout: '💸', review: '🧐',
  disputes: '⚖️', users: '👥', analytics: '📊', rates: '💹', settings: '⚙️', log: '📜',
  profile: '👤', leaderboard: '🏆', performance: '📈',
};

export function roleNav(role) {
  if (role === 'lead_agent') {
    return [
      { to: '/agent', label: 'Submit Lead', icon: ICONS.submit },
      { to: '/agent/leads', label: 'My Leads', icon: ICONS.leads },
      { to: '/agent/earnings', label: 'Earnings', icon: ICONS.earnings },
      { to: '/agent/payouts', label: 'Payouts', icon: ICONS.payout },
      { to: '/agent/profile', label: 'Profile', icon: ICONS.profile },
    ];
  }
  if (role === 'manager') {
    return [
      { to: '/manager', label: 'Review', icon: ICONS.review },
      { to: '/manager/disputes', label: 'Disputes', icon: ICONS.disputes },
      { to: '/manager/leads', label: 'All Leads', icon: ICONS.leads },
      { to: '/manager/performance', label: 'Agents', icon: ICONS.performance },
      { to: '/manager/rates', label: 'Rates', icon: ICONS.rates },
    ];
  }
  return [
    { to: '/admin', label: 'Analytics', icon: ICONS.analytics },
    { to: '/admin/review', label: 'Review', icon: ICONS.review },
    { to: '/admin/leads', label: 'Leads', icon: ICONS.leads },
    { to: '/admin/users', label: 'Users', icon: ICONS.users },
    { to: '/admin/payouts', label: 'Payouts', icon: ICONS.payout },
    { to: '/admin/settings', label: 'Settings', icon: ICONS.settings },
  ];
}

function Brand({ compact = false }) {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <div className="relative w-10 h-10 rounded-xl grid place-items-center font-display font-extrabold text-white shadow-glow bg-brand-grad">
        <span className="relative z-10">K</span>
        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display font-bold text-white tracking-tight">KinTech CRM</div>
          <div className="text-[11px] text-slate-400 font-medium tracking-wide">LEAD GENERATION</div>
        </div>
      )}
    </Link>
  );
}

export default function Layout() {
  const { user, isAdmin, isManager, logout, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState({ rows: [], unread: 0 });
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const nav = roleNav(user?.role);
  const roleLabel = isAdmin ? 'Super Admin' : isManager ? 'Manager' : 'Lead Agent';

  const loadNotifs = useCallback(async () => {
    try {
      const data = await api.get('/notifications?limit=12');
      setNotifs(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 60000); return () => clearInterval(t); }, [loadNotifs]);

  if ((isAdmin || isManager) && user && !user.two_factor_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute w-[30rem] h-[30rem] rounded-full bg-brand-600/20 blur-[120px] animate-aurora" />
        <div className="relative max-w-md w-full card p-8 text-center !bg-ink-800/80 !border-white/10 backdrop-blur-xl shadow-glow-lg">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-grad grid place-items-center text-3xl shadow-glow mb-4 animate-floaty">🔐</div>
          <h1 className="font-display text-xl font-bold text-white">Step up: enable 2FA</h1>
          <p className="text-sm text-slate-400 mt-2">Money is involved — all admin &amp; manager accounts must enable two-factor authentication before accessing the dashboard.</p>
          <Link to="/2fa-setup" className="btn-primary mt-6 w-full !py-3">Set up 2FA now</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex relative">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-ink-900/95 backdrop-blur border-r border-white/5 fixed inset-y-0 left-0 z-40">
        <div className="px-5 py-5 flex items-center border-b border-white/5">
          <Brand />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/agent' || n.to === '/manager' || n.to === '/admin'}
              className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${isActive ? 'bg-brand-600/15 text-white shadow-glow ring-1 ring-brand-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <span className="w-8 h-8 rounded-lg grid place-items-center text-sm">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin/audit" className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${isActive ? 'bg-brand-600/15 text-white shadow-glow ring-1 ring-brand-500/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <span className="w-8 h-8 rounded-lg grid place-items-center text-sm">{ICONS.log}</span>Audit Log
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 pb-3">
            <div className="w-9 h-9 rounded-full bg-brand-500/20 ring-1 ring-brand-500/40 grid place-items-center font-bold text-white text-sm">{initials(user?.name)}</div>
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-slate-500">{roleLabel}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full btn !bg-white/5 !text-slate-300 !border-white/10 hover:!bg-white/10 hover:!text-white">Log out</button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/60">
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5">
            <div className="lg:hidden flex items-center gap-2">
              <Brand compact />
              <span className="font-display font-bold text-slate-800">KinTech</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowNotifs(!showNotifs); }} className="relative w-10 h-10 rounded-xl bg-white/70 border border-slate-200 hover:bg-white grid place-items-center text-base shadow-sm">
                🔔
                {notifs.unread > 0 && <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 grid place-items-center shadow">{notifs.unread}</span>}
              </button>
              <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-white/70 border border-transparent hover:border-slate-200 transition">
                <div className="w-9 h-9 rounded-full bg-brand-grad text-white grid place-items-center font-bold text-sm shadow-glow">{initials(user?.name)}</div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
                  <div className="text-[11px] text-slate-400">{roleLabel}</div>
                </div>
              </button>
            </div>
          </div>

          {showNotifs && (
            <div className="absolute right-4 top-16 w-[92%] max-w-sm card shadow-glow-lg z-50 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">Notifications</span>
                <button className="text-xs text-brand-600 font-semibold hover:underline" onClick={async () => { await api.post('/notifications/read-all'); loadNotifs(); }}>Mark all read</button>
              </div>
              {notifs.rows.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No notifications yet.</div>}
              {notifs.rows.map((n) => (
                <div key={n.id} className={`px-4 py-3 border-b border-slate-50 flex gap-3 ${!n.is_read ? 'bg-brand-50/70' : ''}`}>
                  <div className="text-lg">{n.type === 'super_lead' ? '🏆' : n.type === 'payout_status' ? '💸' : n.type === 'lead_status' ? '📋' : '🔔'}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{n.title}</div>
                    <div className="text-sm text-slate-500 leading-snug">{n.message}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showMenu && (
            <div className="absolute right-4 top-16 w-52 card shadow-glow-lg z-50 p-1.5">
              <Link to={isAdmin ? '/admin/profile' : isManager ? '/manager/profile' : '/agent/profile'} onClick={() => setShowMenu(false)} className="block px-3 py-2.5 rounded-xl text-sm hover:bg-brand-50 text-slate-700">👤 Profile</Link>
              <button onClick={logout} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-rose-50 text-rose-600 font-medium">Log out</button>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 px-3 sm:px-6 py-5 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-t border-white/50 pb-safe shadow-[0_-8px_30px_-10px_rgba(16,24,40,.15)]">
        <div className="grid grid-cols-5 h-16">
          {nav.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/agent' || n.to === '/manager' || n.to === '/admin'}
              className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[10px] ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
              {({ isActive }) => (
                <>
                  <span className={`w-9 h-7 rounded-full grid place-items-center text-lg leading-none transition-all ${isActive ? 'bg-brand-100 shadow-sm' : ''}`}>{n.icon}</span>
                  <span className="w-full text-center truncate px-0.5 font-medium">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}