import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, StatusBadge, TagBadge, Pagination, Loader, EmptyState, Spinner, Modal } from '../../components/ui.jsx';
import { dateFmt } from '../../utils/format.js';

export default function ManagerDisputes() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useAsync(() => api.get(`/review/disputes?page=${page}&limit=20`), [page]);

  const rows = data?.rows || [];

  async function resolve() {
    setBusy(true);
    try {
      const res = await api.post(`/review/dispute/${selected.id}/resolve`, { action, reason });
      toast(action === 'accept' ? 'Dispute accepted — lead approved.' : 'Dispute dismissed.', action === 'accept' ? 'success' : 'error');
      setSelected(null);
      setAction('');
      setReason('');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Disputes" sub="Agents dispute rejections here — re-review and settle." />
      {loading ? <Loader /> : (
        <div className="card divide-y divide-slate-100">
          {rows.length === 0 && <EmptyState icon="⚖️" title="No disputes" hint="Disputed rejections appear here for resolution." />}
          {rows.map((l) => (
            <div key={l.id} className="px-4 py-3.5 hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(l)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-800">{l.client_name} <span className="text-xs text-slate-400 font-normal">by {l.agent_name}</span></div>
                  <div className="text-xs text-slate-400 mt-0.5">{l.whatsapp_number} · {dateFmt(l.created_at)}</div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <StatusBadge status={l.status} />
                  <TagBadge tag={l.auto_validation_tag} />
                </div>
              </div>
              {l.dispute_note && <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-700">“{l.dispute_note}”</div>}
            </div>
          ))}
          <Pagination page={page} total={data?.total || 0} limit={20} onChange={setPage} />
        </div>
      )}

      {selected && (
        <ModalDispute lead={selected} busy={busy} action={action} setAction={setAction} reason={reason} setReason={setReason} resolve={resolve} close={() => setSelected(null)} />
      )}
    </div>
  );
}

function ModalDispute({ lead, busy, action, setAction, reason, setReason, resolve, close }) {
  return (
    <Modal open onClose={close} title={`Dispute · ${lead.client_name}`} wide>
      <div className="space-y-4">
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">Agent's case:</div>{lead.dispute_note}
        </div>
        <div className="bg-rose-50 rounded-xl p-4 text-sm text-rose-700">
          <div className="font-semibold mb-1">Original rejection reason:</div>{lead.rejection_reason || '—'}
        </div>
        {action === 'accept' && (
          <div className="bg-emerald-50 rounded-xl p-3.5 text-sm text-emerald-700">✓ Accepting will approve this lead and grant the agent its commission.</div>
        )}
        <div className="flex gap-2">
          <button className="btn-success" disabled={busy} onClick={() => { setAction('accept'); if (action === 'accept') resolve(); }}>{action === 'accept' ? 'Confirm accept' : '✓ Accept dispute'}</button>
          <button className="btn-danger" disabled={busy} onClick={() => { setAction('dismiss'); if (action === 'dismiss') resolve(); }}>{action === 'dismiss' ? 'Confirm dismiss' : '✕ Dismiss'}</button>
        </div>
        {action && (
          <input className="input" placeholder={action === 'accept' ? 'Note for the agent (optional)' : 'Reason for dismissing (optional)'} value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        {busy && <Spinner className="w-4 h-4 text-brand-600" />}
      </div>
    </Modal>
  );
}