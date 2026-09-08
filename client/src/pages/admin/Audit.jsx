import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { PageTitle, FilterChips, Pagination, Loader, EmptyState } from '../../components/ui.jsx';
import { dateTimeFmt } from '../../utils/format.js';

const ACTIONS = [
  { label: 'All', value: '' },
  { label: 'Auth', value: 'login' },
  { label: 'Lead actions', value: 'lead' },
  { label: 'Payouts', value: 'payout' },
  { label: 'Admin changes', value: 'admin' },
];

export default function AdminAudit() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useAsync(() => api.get(`/admin/audit-logs?page=${page}&limit=50${action ? `&action=${action}` : ''}`), [page, action]);
  const rows = data?.rows || [];

  return (
    <div className="space-y-4">
      <PageTitle title="Audit log" sub="Every sensitive action across the platform, for accountability." />
      <FilterChips options={ACTIONS} value={action} onChange={(v) => { setAction(v); setPage(1); }} />
      {loading ? <Loader /> : (
        <div className="card divide-y divide-slate-100">
          {rows.length === 0 && <EmptyState icon="📜" title="No audit entries" />}
          {rows.map((l) => (
            <div key={l.id} className="px-4 py-3 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-xs text-slate-800">{l.action}</div>
                <div className="text-xs text-slate-400 shrink-0">{dateTimeFmt(l.created_at)}</div>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {l.user_name ? `${l.user_name} (${l.user_email})` : 'System'}
                {l.details ? ` · ${snippet(l.details)}` : ''}
              </div>
            </div>
          ))}
          <Pagination page={page} total={data?.total || 0} limit={50} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function snippet(d) {
  try {
    const o = typeof d === 'string' ? JSON.parse(d) : d;
    const parts = Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    return parts.slice(0, 3).join(' · ');
  } catch { return String(d).slice(0, 120); }
}