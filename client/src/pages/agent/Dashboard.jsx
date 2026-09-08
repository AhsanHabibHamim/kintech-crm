import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePolling } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { StatCard, ProgressBar, Spinner, PageTitle, Modal } from '../../components/ui.jsx';
import LeadForm from '../../components/LeadForm.jsx';
import { taka } from '../../utils/format.js';

export default function AgentDashboard() {
  const [showForm, setShowForm] = useState(false);
  const counts = usePolling(() => api.get('/leads/counts'), 30000, []);
  const elig = usePolling(() => api.get('/payouts/me/eligibility'), 30000, []);
  const summary = usePolling(() => api.get('/payouts/me/summary'), 30000, []);

  const c = counts.data || { pending: 0, under_review: 0, approved: 0, rejected: 0, needs_info: 0 };
  const e = elig.data;
  const s = summary.data;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Submit a lead"
        sub="Validated → reviewed → paid. Duplicate email or WhatsApp is blocked instantly."
        actions={<button className="btn-soft" onClick={() => setShowForm(true)}>+ Full form</button>}
      />
      <LeadForm onSubmitted={() => counts.reload()} />

      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 text-lg">My overview</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Pending" value={c.pending} tone="slate" />
        <StatCard label="Under Review" value={c.under_review} tone="amber" />
        <StatCard label="Approved" value={c.approved} tone="emerald" />
        <StatCard label="Rejected" value={c.rejected} tone="rose" />
        <StatCard label="Super Leads" value={c.super_lead ?? c.approved_super ?? 0} tone="sky" />
        <StatCard label="Trust score" value={c.trust ?? '—'} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-800">💵 Earnings</h3>
          {s ? (
            <div className="space-y-2">
              <EarRow label="Regular commission" value={s.per_lead} />
              <EarRow label="Super Lead bonus" value={s.super_lead} />
              {Number(s.referral) > 0 && <EarRow label="Referral override" value={s.referral} />}
              <div className="h-px bg-slate-100 my-1" />
              <EarRow label="Total earned" value={s.total} strong />
              <EarRow label="Paid out" value={s.total - s.balance} />
              <div className="h-px bg-slate-100 my-1" />
              <EarRow label="Available balance" value={s.balance} strong tone="emerald" />
            </div>
          ) : <Spinner className="w-5 h-5 text-brand-600" />}
          <Link to="/agent/earnings" className="text-sm text-brand-600 font-semibold hover:underline">View earnings ledger →</Link>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-slate-800">🎯 Next withdrawal</h3>
          {e ? (
            <>
              <ProgressBar value={e.since_last} max={e.needed} label={`${e.since_last}/${e.needed} approved leads`} />
              <p className="text-sm text-slate-500">
                {e.met
                  ? 'You qualify! Go to the Payouts tab to request your withdrawal.'
                  : `${e.needed - e.since_last} more approved lead(s) needed (first ${e.first}, then every ${e.subsequent}).`}
              </p>
            </>
          ) : <Spinner className="w-5 h-5 text-brand-600" />}
          <Link to="/agent/payouts" className="text-sm text-brand-600 font-semibold hover:underline">Request payout / history →</Link>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Submit a lead" wide>
        <LeadForm onSubmitted={() => { counts.reload(); setShowForm(false); }} />
      </Modal>
    </div>
  );
}

function EarRow({ label, value, strong, tone = 'slate' }) {
  const tones = { slate: 'text-slate-800', emerald: 'text-emerald-600' };
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold tabular ${strong ? 'text-base' : ''} ${tones[tone]}`}>{taka(value)}</span>
    </div>
  );
}