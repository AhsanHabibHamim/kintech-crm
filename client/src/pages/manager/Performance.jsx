import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { PageTitle, Loader, EmptyState } from '../../components/ui.jsx';
import { taka } from '../../utils/format.js';

export default function ManagerPerformance() {
  const { data, loading } = useAsync(() => api.get('/manager/performance'), []);
  const rows = data?.rows || [];

  return (
    <div className="space-y-4">
      <PageTitle title="Agent performance" sub="Acceptance rate, trust score and earnings per agent." />
      {loading ? <Loader /> : (
        <div className="card overflow-hidden">
          {rows.length === 0 && <EmptyState icon="👥" title="No agents yet" />}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Agent</th>
                    <th className="th hidden sm:table-cell">Trust</th>
                    <th className="th">Total</th>
                    <th className="th">Approved</th>
                    <th className="th">Super</th>
                    <th className="th hidden md:table-cell">Accept %</th>
                    <th className="th text-right">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const acceptRate = a.accept_rate ?? ((a.approved_leads / (a.approved_leads + a.rejected_leads)) * 100 || 0);
                    return (
                      <tr key={a.id} className="border-t border-slate-100 hover-row">
                        <td className="td">
                          <div className="font-semibold text-slate-800">{a.name}</div>
                          <div className="text-xs text-slate-400">{a.email}</div>
                        </td>
                        <td className="td hidden sm:table-cell">
                          <span className={`badge ${a.trust_score >= 85 ? 'bg-emerald-100 text-emerald-700' : a.trust_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{a.trust_score ?? '—'}</span>
                        </td>
                        <td className="td text-slate-600">{a.total_leads}</td>
                        <td className="td text-emerald-600 font-semibold">{a.approved_leads}</td>
                        <td className="td text-sky-600">{a.super_leads}</td>
                        <td className="td hidden md:table-cell text-slate-600">{Math.round(acceptRate)}%</td>
                        <td className="td text-right font-bold tabular text-slate-800">{taka(a.total_earnings)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}