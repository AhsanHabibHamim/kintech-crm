import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { PageTitle, StatCard, Loader, EmptyState } from '../../components/ui.jsx';
import { taka, dateTimeFmt, timeAgo } from '../../utils/format.js';

const TYPE_META = {
  per_lead: { label: 'Per-lead commission', cls: 'bg-emerald-100 text-emerald-700' },
  super_lead_bonus: { label: 'Super Lead bonus', cls: 'bg-sky-100 text-sky-700' },
  referral_override: { label: 'Referral override', cls: 'bg-violet-100 text-violet-700' },
};

export default function AgentEarnings() {
  const summary = useAsync(() => api.get('/payouts/me/summary'), []);
  const ledger = useAsync(() => api.get('/payouts/me/ledger?limit=200'), []);
  const s = summary.data;

  return (
    <div className="space-y-5">
      <PageTitle title="Earnings" sub="Regular commission credited the moment a lead is approved." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total earned" value={taka(s?.total)} tone="emerald" />
        <StatCard label="Regular commission" value={taka(s?.per_lead)} />
        <StatCard label="Super Lead bonus" value={taka(s?.super_lead)} tone="sky" />
        <StatCard label="Available balance" value={taka(s?.balance)} tone="brand" />
      </div>

      {ledger.loading ? <Loader label="Loading ledger…" />
        : (
          <div className="card divide-y divide-slate-100">
            {!ledger.data?.rows?.length && <EmptyState icon="💸" title="No earnings yet" hint="Approvals land here with the exact rate applied." />}
            {ledger.data?.rows?.map((e) => {
              const m = TYPE_META[e.type] || { label: e.type, cls: 'bg-slate-100 text-slate-600' };
              return (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{e.client_name || 'Referral credit'}{e.is_super_lead && <span className="ml-1">🏆</span>}</div>
                    <div className="text-xs flex items-center gap-2 flex-wrap"><span className={`badge ${m.cls}`}>{m.label}</span><span className="text-slate-400">{timeAgo(e.created_at)}</span></div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold tabular ${e.type === 'super_lead_bonus' ? 'text-sky-600' : 'text-emerald-600'}`}>+{taka(e.amount)}</div>
                    <div className="text-[11px] text-slate-400">{dateTimeFmt(e.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}