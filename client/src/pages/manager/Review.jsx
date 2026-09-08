import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, TagBadge, FilterChips, Pagination, Loader, EmptyState } from '../../components/ui.jsx';
import LeadDetailModal from '../../components/LeadDetailModal.jsx';
import { dateFmt } from '../../utils/format.js';

const QUEUE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: '🟢 Likely Valid', value: 'likely_valid' },
  { label: '🟡 Needs Review', value: 'needs_review' },
  { label: '🔴 Likely Invalid', value: 'likely_invalid' },
  { label: '⚖️ Disputed', value: 'disputed' },
];

export default function ManagerReview() {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loader = () => {
    let q = `page=${page}&limit=20&status=pending,under_review,needs_info`;
    if (filter === 'disputed') q += '&dispute=true';
    else if (filter !== 'all') q += `&tag=${filter}`;
    return api.get(`/review/queue?${q}`);
  };
  const { data, loading, reload } = useAsync(loader, [page, filter]);

  const rows = data?.rows || [];
  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allChecked) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    setSelectedIds(next);
  }
  function toggleOne(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function runBulk(action) {
    setBusy(true);
    try {
      const res = await api.post('/review/bulk', { lead_ids: [...selectedIds], action, reason: bulkReason });
      toast(`Done. ${res.results?.approved ?? res.results?.rejected ?? res.results?.needs_info ?? 0} lead(s) updated.`, 'success');
      setSelectedIds(new Set());
      setBulkAction('');
      setBulkReason('');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Review queue" sub="Triage leads by auto-validation tag — approve, reject, or ask for more info." />
      <FilterChips options={QUEUE_FILTERS} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} />

      {selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-brand-800">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button className="btn-success !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => setBulkAction('approved')}>✓ Approve</button>
            <button className="btn-danger !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => setBulkAction('rejected')}>✕ Reject</button>
            <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => runBulk('needs_info')}>More info</button>
          </div>
          {bulkAction === 'rejected' && (
            <input className="input !py-1.5 text-xs flex-1 min-w-[180px]" placeholder="Rejection reason (required) for all selected…" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} />
          )}
          {(bulkAction === 'approved' || bulkAction === 'rejected') && (
            <button className="btn-primary !px-4 !py-1.5 text-xs" disabled={busy || (bulkAction === 'rejected' && !bulkReason)} onClick={() => runBulk(bulkAction)}>
              {busy ? 'Working…' : `Confirm ${bulkAction === 'approved' ? 'approve' : 'reject'}`}
            </button>
          )}
        </div>
      )}

      {loading ? <Loader /> : (
        <div className="card overflow-hidden">
          {rows.length === 0 && <EmptyState icon="📥" title="Queue is clear" hint="New submissions needing review will appear here." />}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th w-10"><button onClick={toggleAll} className="w-4 h-4 border rounded border-slate-300 inline-flex items-center justify-center text-[10px]">{allChecked ? '✓' : ''}</button></th>
                    <th className="th">Client</th>
                    <th className="th hidden sm:table-cell">Agent</th>
                    <th className="th hidden md:table-cell">WhatsApp</th>
                    <th className="th">Tag</th>
                    <th className="th hidden lg:table-cell">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 hover-row cursor-pointer" onClick={() => setSelected(l)}>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleOne(l.id)} className={`w-4 h-4 rounded border inline-flex items-center justify-center text-[10px] ${selectedIds.has(l.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300'}`}>{selectedIds.has(l.id) ? '✓' : ''}</button>
                      </td>
                      <td className="td">
                        <div className="font-semibold text-slate-800">{l.client_name}{l.dispute_requested && <span className="ml-1" title="Disputed">⚖️</span>}</div>
                        <div className="text-xs text-slate-400 md:hidden">{l.whatsapp_number}</div>
                      </td>
                      <td className="td hidden sm:table-cell text-slate-600">{l.agent_name}</td>
                      <td className="td hidden md:table-cell text-slate-600">{l.whatsapp_number}</td>
                      <td className="td"><TagBadge tag={l.auto_validation_tag} /></td>
                      <td className="td hidden lg:table-cell text-slate-500">{dateFmt(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={data?.total || 0} limit={20} onChange={setPage} />
        </div>
      )}

      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} canReview onChanged={reload} />}
    </div>
  );
}