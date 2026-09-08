import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
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

export default function ManagerLeads() {
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const loader = () => api.get(`/leads?limit=15&page=${page}&status=${filters.status}&q=${filters.q}`);
  const { data, loading, reload } = useAsync(loader, [page, filters.status, filters.q]);

  return (
    <div className="space-y-4">
      <PageTitle title="All leads" sub="Every lead across the agency, with full review history." />
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <SearchBox value={filters.q} onChange={(v) => { setFilters((f) => ({ ...f, q: v })); setPage(1); }} placeholder="Search client, email, phone…" />
        <FilterChips options={STATUS_OPTIONS} value={filters.status} onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} />
      </div>
      {loading ? <Loader /> : <>
        <LeadTable rows={data?.rows || []} onOpen={setSelected} showAgent />
        <Pagination page={page} total={data?.total || 0} limit={15} onChange={setPage} />
      </>}
      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} canReview={false} onChanged={reload} />}
    </div>
  );
}