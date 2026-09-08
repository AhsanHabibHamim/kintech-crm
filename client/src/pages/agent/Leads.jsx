import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { PageTitle, StatusBadge, TagBadge, SearchBox, FilterChips, Pagination, Loader, EmptyState } from '../../components/ui.jsx';
import LeadDetailModal from '../../components/LeadDetailModal.jsx';
import { dateFmt } from '../../utils/format.js';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Needs Info', value: 'needs_info' },
];

export function LeadTable({ rows, onOpen, showAgent = false, showReviewer = false }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Client</th>
              <th className="th hidden sm:table-cell">WhatsApp</th>
              <th className="th hidden md:table-cell">Category</th>
              <th className="th hidden md:table-cell">Service</th>
              <th className="th">Status</th>
              <th className="th hidden sm:table-cell">Tag</th>
              {showAgent && <th className="th hidden lg:table-cell">Agent</th>}
              {showReviewer && <th className="th hidden lg:table-cell">Accepted</th>}
              <th className="th hidden lg:table-cell">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 hover-row cursor-pointer" onClick={() => onOpen(l)}>
                <td className="td">
                  <div className="font-semibold text-slate-800">{l.client_name}{l.is_super_lead && <span className="ml-1">🏆</span>}</div>
                  <div className="text-xs text-slate-400 lg:hidden">{l.email}</div>
                </td>
                <td className="td hidden sm:table-cell text-slate-600">{l.whatsapp_number}</td>
                <td className="td hidden md:table-cell text-slate-600">{l.category || '—'}</td>
                <td className="td hidden md:table-cell text-slate-600"><span title={l.service_interested_in} className="block max-w-[16rem] truncate">{l.sub_service || l.service_interested_in}</span></td>
                <td className="td"><StatusBadge status={l.status} /></td>
                <td className="td hidden sm:table-cell"><TagBadge tag={l.auto_validation_tag} /></td>
                {showAgent && <td className="td hidden lg:table-cell text-slate-600">{l.agent_name ? `${l.agent_name} (ID ${l.agent_id ?? '-'})` : '—'}</td>}
                {showReviewer && <td className="td hidden lg:table-cell text-slate-600">{l.reviewer_name || '—'}</td>}
                <td className="td hidden lg:table-cell text-slate-500">{dateFmt(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <EmptyState icon="📋" title="No leads found" />}
    </div>
  );
}

export default function AgentLeads() {
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const loader = () => api.get(`/leads?limit=15&page=${page}&status=${filters.status}&q=${filters.q}`);
  const { data, loading, reload } = useAsync(loader, [page, filters.status, filters.q]);

  return (
    <div className="space-y-4">
      <PageTitle title="My leads" sub="Every lead you've submitted, with live status." />
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <SearchBox value={filters.q} onChange={(v) => { setFilters((f) => ({ ...f, q: v })); setPage(1); }} placeholder="Search client, email, phone…" />
        <FilterChips options={STATUS_OPTIONS} value={filters.status} onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} />
      </div>
      {loading ? <Loader /> : <LeadTable rows={data?.rows || []} onOpen={setSelected} />}
      <Pagination page={page} total={data?.total || 0} limit={15} onChange={setPage} />
      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} canReview={false} onChanged={reload} />}
    </div>
  );
}