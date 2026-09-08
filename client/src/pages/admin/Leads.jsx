import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api, downloadFile } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, FilterChips, SearchBox, Pagination, Loader } from '../../components/ui.jsx';
import LeadDetailModal from '../../components/LeadDetailModal.jsx';
import { LeadTable } from '../agent/Leads.jsx';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Needs Info', value: 'needs_info' },
];

export default function AdminLeads() {
  const toast = useToast();
  const [filters, setFilters] = useState({ q: '', status: '', super: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const { data, loading, reload } = useAsync(() => api.get(`/leads?limit=15&page=${page}&status=${filters.status}&q=${filters.q}`), [page, filters.status, filters.q]);

  function exportCsv(kind) {
    const params = new URLSearchParams({ status: filters.status, q: filters.q });
    downloadFile(`/admin/export/${kind}?${params}`).catch((e) => toast(e.message, 'error'));
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="All leads"
        sub="Full agency lead database with export."
        actions={<div className="flex gap-2"><button className="btn-soft !py-1.5" onClick={() => exportCsv('leads')}>⭳ CSV</button></div>}
      />
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <SearchBox value={filters.q} onChange={(v) => { setFilters((f) => ({ ...f, q: v })); setPage(1); }} placeholder="Search client, email, phone…" />
        <FilterChips options={STATUS_OPTIONS} value={filters.status} onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} />
      </div>
      {loading ? <Loader /> : <>
        <LeadTable rows={data?.rows || []} onOpen={setSelected} showAgent showReviewer />
        <Pagination page={page} total={data?.total || 0} limit={15} onChange={setPage} />
      </>}
      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} canReview onChanged={reload} />}
    </div>
  );
}