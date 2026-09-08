import { useState, useEffect } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { PageTitle, StatCard, Loader, EmptyState } from '../../components/ui.jsx';
import { taka } from '../../utils/format.js';

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('month');
  const stats = useAsync(() => api.get('/admin/stats'), []);
  const leader = useAsync(() => api.get(`/admin/leaderboard?period=${period}`), [period]);
  const d = stats.data;

  if (stats.loading) return <Loader />;

  return (
    <div className="space-y-5">
      <PageTitle title="Analytics" sub="Agency-wide performance at a glance." />

      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total agents" value={d.stats.agents_count} sub={`${d.stats.agents_pending || 0} pending approval`} tone="slate" />
            <StatCard label="Total leads" value={d.stats.total_leads} sub={`${d.stats.approved_leads} approved`} />
            <StatCard label="Approval rate" value={d.stats.approval_rate != null ? `${d.stats.approval_rate}%` : '—'} tone="emerald" />
            <StatCard label="Commissions paid" value={taka(d.stats.total_paid_out)} tone="emerald" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Leads pending" value={d.stats.pending_leads} tone="amber" />
            <StatCard label="Leads under review" value={d.stats.under_review} tone="amber" />
            <StatCard label="Super leads" value={d.stats.super_leads} tone="sky" />
            <StatCard label="Open disputes" value={d.stats.disputes_open} tone="rose" />
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart rows={d?.trends || []} />
        <ServiceBreakdown rows={d?.services || []} />
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">🏆 Leaderboard</h3>
          <div className="flex gap-1">
            {['week', 'month', 'all'].map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${period === p ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{p === 'all' ? 'all time' : p}</button>
            ))}
          </div>
        </div>
        {leader.loading ? <Loader /> : (
          <div className="divide-y divide-slate-100">
            {(leader.data?.rows || []).length === 0 && <EmptyState icon="🏆" title="No data yet" />}
            {leader.data?.rows?.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center justify-center">{i + 1}</span>
                  <div>
                    <div className="font-semibold text-slate-800">{a.name}</div>
                    <div className="text-xs text-slate-400">{a.approved_leads} approved · {a.super_leads} super</div>
                  </div>
                </div>
                <div className="font-bold tabular text-emerald-600">{taka(a.total_earnings)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  const day = (dayStr) => {
    const d = new Date(dayStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-bold text-slate-800">📈 Daily leads (last 30 days)</h3>
      {rows.length === 0 ? <EmptyState icon="📊" title="No data yet" /> : (
        <div className="flex items-end gap-1.5 h-40">
          {rows.map((r) => (
            <div key={r.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
              <span className="text-[10px] text-slate-500 tabular opacity-0 group-hover:opacity-100 transition">{r.leads}</span>
              <div className="w-full rounded-t bg-brand-600/80 hover:bg-brand-600 transition-all" style={{ height: `${Math.max(4, (r.leads / max) * 70)}%` }} />
              <span className="text-[10px] text-slate-400 hidden sm:block">{day(r.day)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceBreakdown({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-bold text-slate-800">🧩 Leads by service</h3>
      {rows.length === 0 ? <EmptyState icon="🧰" title="No data yet" /> : (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={r.service || `svc-${i}`}>
              <div className="flex justify-between text-xs text-slate-600 mb-1"><span>{r.service || 'Unspecified'}</span><span className="tabular">{r.n}</span></div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}