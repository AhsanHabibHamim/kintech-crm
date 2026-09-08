import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api, resolveUrl } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, ProgressBar, Spinner, StatCard, Modal, EmptyState } from '../../components/ui.jsx';
import { taka, dateTimeFmt } from '../../utils/format.js';

const PAYOUT_META = {
  requested: { label: 'Requested', cls: 'bg-amber-100 text-amber-700' },
  processing: { label: 'Processing', cls: 'bg-sky-100 text-sky-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
};

export default function AgentPayouts() {
  const { user } = useAuth();
  const toast = useToast();
  const elig = useAsync(() => api.get('/payouts/me/eligibility'), []);
  const summary = useAsync(() => api.get('/payouts/me/summary'), []);
  const history = useAsync(() => api.get('/payouts/me?limit=100'), []);
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState('bkash');
  const [account, setAccount] = useState(user?.bkash_number && method === 'bkash' ? user.bkash_number : user?.nagad_number || '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState(null);

  const e = elig.data;
  const s = summary.data;
  const rows = history.data?.rows || [];

  async function request() {
    setBusy(true);
    try {
      await api.post('/payouts/request', { method, account_number: account, amount: Number(amount) });
      toast('Payout request submitted. Admin will process it shortly.', 'success');
      setShowForm(false);
      setMethod('bkash');
      history.reload();
      elig.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle title="Withdrawals" sub="bKash / Nagad payouts once you hit the approved-lead threshold." />

      {e && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Withdrawal progress</h3>
            <span className={`badge ${e.met ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{e.met ? 'Qualified 🎉' : 'In progress'}</span>
          </div>
          <ProgressBar value={e.since_last} max={e.needed} label={`${e.since_last}/${e.needed} approved leads`} />
          <p className="text-sm text-slate-500">First withdrawal unlocks at {e.first} approved leads, then every {e.subsequent} thereafter.</p>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <StatCard label="Approved" value={e.approved_total} />
            <StatCard label="Since last" value={e.since_last} />
            <StatCard label="Balance" value={taka(s?.balance)} tone="emerald" />
          </div>
          {e.met && Number(s?.balance) > 0 && (
            <button className="btn-primary" onClick={() => { setAmount(String(s.balance)); setShowForm(true); }}>Request payout ({taka(Math.min(s.balance, s.balance))})</button>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800">Payout history</h3>
          <div className="card divide-y divide-slate-100">
            {rows.map((p) => {
              const m = PAYOUT_META[p.status] || { label: p.status, cls: 'bg-slate-100' };
              return (
                <div key={p.id} className="px-4 py-3.5 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-800">{taka(p.amount)} <span className="text-xs text-slate-400 font-normal">via {p.method === 'bkash' ? 'bKash' : 'Nagad'} · {p.account_number}</span></div>
                      <div className="text-xs text-slate-400 mt-0.5">{dateTimeFmt(p.created_at)}</div>
                    </div>
                    <span className={`badge ${m.cls}`}>{m.label}</span>
                  </div>
                  {p.status === 'paid' && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
                      <span className="text-xs text-slate-400">Payment proof:</span>
                      <button className="text-emerald-600 font-semibold underline" onClick={() => setProof(resolveUrl(p.proof_image_url))}>View screenshot</button>
                    </div>
                  )}
                  {p.processing_note && <div className="mt-1.5 text-xs text-slate-500">Note: {p.processing_note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 && <EmptyState icon="💸" title="No payouts yet" hint={e?.met ? 'You qualify — request your first withdrawal above.' : 'Keep submitting verified leads to unlock withdrawals.'} />}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Request payout">
        <div className="space-y-4">
          <div>
            <label className="label">Payment method</label>
            <div className="grid grid-cols-2 gap-2">
              {['bkash', 'nagad'].map((m) => (
                <button key={m} onClick={() => { setMethod(m); setAccount((user?.[m === 'bkash' ? 'bkash_number' : 'nagad_number']) || ''); }}
                  className={`rounded-xl border-2 py-3 font-bold transition ${method === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}>
                  {m === 'bkash' ? 'bKash' : 'Nagad'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Account number</label>
            <input className="input" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="01XXXXXXXXX" inputMode="numeric" />
          </div>
          <div>
            <label className="label">Amount (max {taka(s?.balance)})</label>
            <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" step="0.01" />
          </div>
          <button className="btn-primary w-full" disabled={busy || !account || !amount || Number(amount) <= 0} onClick={request}>
            {busy ? <Spinner className="w-4 h-4" /> : 'Submit request'}
          </button>
        </div>
      </Modal>

      <Modal open={!!proof} onClose={() => setProof(null)} title="Payment proof">
        <img src={proof} alt="Payment proof" className="w-full rounded-xl" />
      </Modal>
    </div>
  );
}