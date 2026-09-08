import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api, downloadFile } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, Toggle, Modal, Spinner, Pagination, Loader, EmptyState } from '../../components/ui.jsx';
import { dateFmt } from '../../utils/format.js';

const ROLE_LABEL = { super_admin: 'Admin', manager: 'Manager', lead_agent: 'Agent' };

export default function AdminUsers() {
  const toast = useToast();
  const [tab, setTab] = useState('agents');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [reset, setReset] = useState(null);
  const { data, loading, reload } = useAsync(() => api.get(`/admin/users?page=${page}&limit=25&q=${q}`), [page, q, tab]);

  const pending = data?.pending_stats?.pending_agents || 0;
  const rows = data?.rows || [];

  async function approve(u) {
    await api.post(`/admin/agents/${u.id}/approve`);
    toast(`${u.name} approved.`, 'success');
    reload();
  }
  async function reject(u) {
    await api.post(`/admin/agents/${u.id}/reject`);
    toast(`${u.name} rejected & removed.`, 'error');
    reload();
  }
  async function toggleStatus(u, status) {
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status });
      toast(status === 'active' ? `${u.name} activated.` : `${u.name} suspended.`, 'success');
      reload();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function togglePerm(u, perm, value) {
    try {
      await api.patch(`/admin/users/${u.id}/permission`, { permission: perm, value });
      reload();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function changeRole(u, role) {
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role });
      toast('Role updated.', 'success');
      reload();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function doReset() {
    try {
      await api.post(`/admin/users/${reset.id}/reset-password`, { new_password: reset.password });
      toast(`Password for ${reset.name} reset.`, 'success');
      setReset(null);
    } catch (e) { toast(e.message, 'error'); }
  }

  const pendingRows = rows.filter((r) => r.role === 'lead_agent' && r.status === 'pending');

  return (
    <div className="space-y-4">
      <PageTitle
        title="Users & agents"
        sub={`${pending} pending agent approval(s)`}
        actions={<div className="flex gap-2"><button className="btn-soft !py-1.5" onClick={() => downloadFile('/admin/export/agents').catch((e) => toast(e.message, 'error'))}>⭳ CSV</button></div>}
      />

      <div className="flex gap-1.5 flex-wrap">
        {[['agents', 'Agent approval queue'], ['all', 'All users']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === k ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {label} {k === 'agents' && pending > 0 && <span className="ml-1 px-1.5 rounded-full bg-rose-500 text-white text-[10px]">{pending}</span>}
          </button>
        ))}
      </div>

      {tab === 'agents' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {pendingRows.length === 0 && <EmptyState icon="✅" title="No agents waiting for approval" />}
          {pendingRows.map((u) => (
            <div key={u.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800">{u.name}</div>
                <div className="text-xs text-slate-400">{u.email} · {dateFmt(u.created_at)}</div>
                {u.referred_by && <div className="text-xs text-brand-600 mt-0.5">referred by agent</div>}
              </div>
              <div className="flex gap-2">
                <button className="btn-success !px-3 !py-1.5 text-xs" onClick={() => approve(u)}>Approve</button>
                <button className="btn-danger !px-3 !py-1.5 text-xs" onClick={() => reject(u)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? <Loader /> : (
        <div className="card overflow-hidden">
          {rows.length === 0 && <EmptyState icon="👥" title="No users found" />}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">User</th>
                    <th className="th hidden md:table-cell">Role</th>
                    <th className="th hidden lg:table-cell">Trust</th>
                    <th className="th">Status</th>
                    <th className="th hidden lg:table-cell">Rates</th>
                    <th className="th hidden lg:table-cell">Payouts</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 hover-row">
                      <td className="td">
                        <div className="font-semibold text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="td hidden md:table-cell">
                        {u.role === 'super_admin' ? (
                          <div className="flex items-center gap-2">
                            <span className="badge bg-slate-100 text-slate-600">{ROLE_LABEL[u.role] || u.role}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="badge bg-slate-100 text-slate-600">{ROLE_LABEL[u.role] || u.role}</span>
                            <select
                              className="text-xs border rounded px-1 py-0.5 text-slate-600"
                              value={u.role}
                              onChange={(e) => changeRole(u, e.target.value)}
                            >
                              <option value="lead_agent">→ Agent</option>
                              <option value="manager">→ Manager</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="td hidden lg:table-cell text-slate-600">{u.trust_score ?? '—'}</td>
                      <td className="td">
                        <select className="text-xs border rounded px-1 py-0.5" value={u.status}
                          onChange={(e) => toggleStatus(u, e.target.value)}
                          disabled={u.role === 'super_admin'}>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                      <td className="td hidden lg:table-cell">
                        {u.role === 'manager'
                          ? <Toggle checked={!!u.permissions?.manage_rates} onChange={(v) => togglePerm(u, 'manage_rates', v)} label="" />
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="td hidden lg:table-cell">
                        {u.role === 'manager'
                          ? <Toggle checked={!!u.permissions?.manage_payouts} onChange={(v) => togglePerm(u, 'manage_payouts', v)} label="" />
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="td text-right">
                        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setReset(u)}>Reset pwd</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={data?.total || 0} limit={25} onChange={setPage} />
        </div>
      )}

      <Modal open={!!reset} onClose={() => setReset(null)} title={`Reset password · ${reset?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Set a temporary password for this user. They will be logged out everywhere.</p>
          <input className="input" placeholder="New temporary password" value={reset?.password || ''} onChange={(e) => setReset((r) => ({ ...r, password: e.target.value }))} />
          <button className="btn-primary w-full" disabled={!reset?.password || reset.password.length < 6} onClick={doReset}>
            <Spinner className="w-4 h-4" /> Reset password
          </button>
        </div>
      </Modal>
    </div>
  );
}