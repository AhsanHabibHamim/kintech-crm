import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api, API_BASE, resolveUrl } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, StatCard, Modal, Spinner, Pagination, Loader, EmptyState } from '../../components/ui.jsx';
import { taka, dateTimeFmt } from '../../utils/format.js';

const META = {
  requested: { label: 'Requested', cls: 'bg-amber-100 text-amber-700' },
  processing: { label: 'Processing', cls: 'bg-sky-100 text-sky-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
};

export default function AdminPayouts() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const { data, loading, reload } = useAsync(() => api.get(`/payouts?page=${page}&limit=20${status ? `&status=${status}` : ''}`), [page, status]);

  const rows = data?.rows || [];
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Payout requests"
        sub="Process withdrawals and upload payment proof."
        actions={<div className="flex gap-2"><button className="btn-soft !py-1.5" onClick={() => window.open(`${API_BASE}/admin/export/payouts`, '_blank')}>⭳ CSV</button></div>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Awaiting" value={stats?.requested ?? 0} tone="amber" />
        <StatCard label="Processing" value={stats?.processing ?? 0} tone="sky" />
        <StatCard label="Paid (total)" value={taka(stats?.paid_total)} tone="emerald" />
        <StatCard label="Rejected" value={stats?.rejected ?? 0} tone="rose" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[{ label: 'All', value: '' }, { label: 'Requested', value: 'requested' }, { label: 'Processing', value: 'processing' }, { label: 'Paid', value: 'paid' }, { label: 'Rejected', value: 'rejected' }].map((o) => (
          <button key={o.value} onClick={() => { setStatus(o.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === o.value ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {o.label}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div className="card overflow-hidden">
          {rows.length === 0 && <EmptyState icon="💸" title="No payouts here yet" />}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Agent</th>
                    <th className="th hidden md:table-cell">Method / account</th>
                    <th className="th text-right">Amount</th>
                    <th className="th hidden lg:table-cell">Basis</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const m = META[p.status] || { label: p.status, cls: 'bg-slate-100 text-slate-600' };
                    return (
                      <tr key={p.id} className="border-t border-slate-100 hover-row cursor-pointer" onClick={() => setSelected(p)}>
                        <td className="td">
                          <div className="font-semibold text-slate-800">{p.agent_name}</div>
                          <div className="text-xs text-slate-400">{dateTimeFmt(p.created_at)}</div>
                        </td>
                        <td className="td hidden md:table-cell text-slate-600"><span className="uppercase text-[10px]">{p.method}</span> · {p.account_number}</td>
                        <td className="td text-right font-bold tabular text-slate-800">{taka(p.amount)}</td>
                        <td className="td hidden lg:table-cell text-xs text-slate-400">{p.approved_lead_basis} approved</td>
                        <td className="td"><span className={`badge ${m.cls}`}>{m.label}</span></td>
                        <td className="td text-right"><button className="text-xs font-semibold text-brand-600" onClick={(e) => { e.stopPropagation(); setSelected(p); }}>Process →</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={data?.total || 0} limit={20} onChange={setPage} />
        </div>
      )}

      {selected && <PayoutModal payout={selected} onClose={() => setSelected(null)} onChanged={reload} toast={toast} />}
    </div>
  );
}

function PayoutModal({ payout, onClose, onChanged, toast }) {
  const ALLOWED = { requested: ['processing', 'rejected'], processing: ['paid', 'rejected'] };
  const options = (ALLOWED[payout.status] || []);
  const [action, setAction] = useState(options[0] || '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const isResolved = !options.length; // rejected is terminal

  async function submit() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('status', action);
      if (note) fd.append('note', note);
      if (file) fd.append('proof', file);
      const res = await api.patch(`/payouts/${payout.id}/status`, fd);
      toast(`Payout ${action}.`, action === 'rejected' ? 'error' : 'success');
      onChanged();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const m = META[payout.status] || {};

  return (
    <Modal open onClose={onClose} title={`Payout ${payout.id} · ${payout.agent_name}`} wide>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Kv k="Amount" v={taka(payout.amount)} />
          <Kv k="Method" v={`${payout.method === 'bkash' ? 'bKash' : 'Nagad'} · ${payout.account_number}`} />
          <Kv k="Requested" v={dateTimeFmt(payout.created_at)} />
          <Kv k="Status" v={<span className={`badge ${m.cls}`}>{m.label}</span>} />
        </div>

        {payout.status === 'paid' && payout.proof_image_url && (
          <div>
            <div className="label">Payment proof on file</div>
            <img src={resolveUrl(payout.proof_image_url)} alt="proof" className="rounded-xl border max-h-64" />
          </div>
        )}

        {!isResolved && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label className="label">Move to</label>
              <div className={options.length > 2 ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
                {options.map((s) => (
                  <button key={s}
                    onClick={() => setAction(s)}
                    className={`rounded-xl border-2 py-2.5 text-sm font-bold transition ${action === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {action === 'rejected' && (
              <textarea className="input" rows={2} placeholder="Rejection reason (visible to the agent)" value={note} onChange={(e) => setNote(e.target.value)} />
            )}
            {action === 'paid' && (
              <div>
                <label className="label">Payment proof screenshot (required)</label>
                <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            )}
            <button className="btn-primary w-full" disabled={busy || (action === 'paid' && !file) || (action === 'rejected' && !note)} onClick={submit}>
              {busy ? <Spinner className="w-4 h-4" /> : `Confirm ${action}`}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Kv({ k, v }) {
  return <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</div><div className="text-slate-700 mt-0.5">{v}</div></div>;
}