import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import TwoFactorSetup from './pages/TwoFactorSetup.jsx';
import TwoFactorVerify from './pages/TwoFactorVerify.jsx';

import AgentDashboard from './pages/agent/Dashboard.jsx';
import AgentLeads from './pages/agent/Leads.jsx';
import AgentEarnings from './pages/agent/Earnings.jsx';
import AgentPayouts from './pages/agent/Payouts.jsx';
import Profile from './pages/shared/Profile.jsx';

import ManagerReview from './pages/manager/Review.jsx';
import ManagerDisputes from './pages/manager/Disputes.jsx';
import ManagerLeads from './pages/manager/Leads.jsx';
import ManagerPerformance from './pages/manager/Performance.jsx';
import ManagerRates from './pages/manager/Rates.jsx';

import AdminAnalytics from './pages/admin/Analytics.jsx';
import AdminLeads from './pages/admin/Leads.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminPayouts from './pages/admin/Payouts.jsx';
import AdminSettings from './pages/admin/Settings.jsx';
import AdminAudit from './pages/admin/Audit.jsx';
import AdminRates from './pages/admin/Rates.jsx';

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-ink-900 via-brand-800 to-ink-900">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="w-9 h-9 text-brand-400" />
        <p className="text-sm text-blue-100/80 font-medium tracking-wide">Loading KinTech CRM…</p>
      </div>
    </div>
  );
}

function RequireRole({ roles, children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'lead_agent' && !user.two_factor_enabled && location.pathname !== '/2fa-setup') {
    return <Navigate to="/2fa-setup" replace />;
  }
  if (!roles.includes(user.role)) {
    const target = user.role === 'super_admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/agent';
    return <Navigate to={target} replace />;
  }
  return children;
}

export default function App() {
  const { user, loading, bootstrap } = useAuth();
  useEffect(() => { bootstrap(); }, []); // eslint-disable-line

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/2fa-setup" element={<RequireRole roles={['super_admin', 'manager']}><TwoFactorSetup /></RequireRole>} />
      <Route path="/2fa-verify" element={<TwoFactorVerify />} />

      <Route path="/agent" element={<RequireRole roles={['lead_agent']}><Layout /></RequireRole>}>
        <Route index element={<AgentDashboard />} />
        <Route path="leads" element={<AgentLeads />} />
        <Route path="earnings" element={<AgentEarnings />} />
        <Route path="payouts" element={<AgentPayouts />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/manager" element={<RequireRole roles={['manager', 'super_admin']}><Layout /></RequireRole>}>
        <Route index element={<ManagerReview />} />
        <Route path="disputes" element={<ManagerDisputes />} />
        <Route path="leads" element={<ManagerLeads />} />
        <Route path="performance" element={<ManagerPerformance />} />
        <Route path="rates" element={<ManagerRates />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/admin" element={<RequireRole roles={['super_admin']}><Layout /></RequireRole>}>
        <Route index element={<AdminAnalytics />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="review" element={<ManagerReview />} />
        <Route path="disputes" element={<ManagerDisputes />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="rates" element={<AdminRates />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/" element={<RoleHomeRedirect loading={loading} user={user} />} />
      <Route path="*" element={<NotFound user={user} loading={loading} />} />
    </Routes>
  );
}

function RoleHomeRedirect({ user, loading }) {
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const target = user.role === 'super_admin' ? '/admin' : user.role === 'manager' ? '/manager' : '/agent';
  return <Navigate to={target} replace />;
}

function NotFound({ user, loading, error }) {
  if (!loading && !user) return <Navigate to="/login" replace />;
  const target = user?.role === 'super_admin' ? '/admin' : user?.role === 'manager' ? '/manager' : '/agent';
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <div className="text-6xl mb-4">🧭</div>
        <h1 className="text-2xl font-extrabold text-slate-800">Page not found</h1>
        <p className="text-slate-500 mt-1">{error ? String(error) : 'The page you tried to open does not exist.'}</p>
        <Link to={target} className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    </div>
  );
}