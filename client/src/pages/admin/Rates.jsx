import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, Spinner, EmptyState } from '../../components/ui.jsx';
import { taka, dateTimeFmt } from '../../utils/format.js';

export default function AdminRates() {
  const toast = useToast();
  const { data, reload } = useAsync(() => api.get('/admin/rates'), []);
  const [type, setType] = useState('per_lead');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.post('/admin/rates', { type, amount: Number(amount) });
      toast('Rate updated.', 'success');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const perLead = data?.per_lead;
  const superLead = data?.super_lead;
  const historyRows = data?.history?.[type] || [];

  return (
    <div className="space-y-5">
      <PageTitle title="Commission rates" sub="Rate is captured per approval — past leads keep the rate they were approved under." />

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="card p-5">
          <div className="text-xs font-medium text-slate-500">Per approved lead</div>
          <div className="text-3xl font-extrabold text-emerald-600 tabular mt-1">{taka(perLead?.amount)}</div>
          <div className="text-xs text-slate-400 mt-1">{perLead?.updated_at ? `updated ${dateTimeFmt(perLead.updated_at)}` : ''}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-slate-500">Super Lead bonus</div>
          <div className="text-3xl font-extrabold text-sky-600 tabular mt-1">{taka(superLead?.amount)}</div>
          <div className="text-xs text-slate-400 mt-1">{superLead?.updated_at ? `updated ${dateTimeFmt(superLead.updated_at)}` : ''}</div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-slate-800">Set new rate</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="input !py-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="per_lead">Per approved lead</option>
            <option value="super_lead">Super Lead bonus</option>
          </select>
          <input className="input !py-2" type="number" inputMode="decimal" step="0.01" placeholder="Amount (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn-primary" disabled={busy || !amount || Number(amount) <= 0} onClick={save}>{busy ? <Spinner className="w-4 h-4" /> : 'Save rate'}</button>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-slate-800">Change history — {type === 'per_lead' ? 'per lead' : 'super lead bonus'}</h3>
        {historyRows.length === 0 && <EmptyState icon="🕘" title="No history yet" />}
        <div className="divide-y divide-slate-100">
          {historyRows.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="font-semibold tabular text-slate-800">{taka(r.amount)}</div>
                <div className="text-xs text-slate-400">{r.updated_by_name || `user #${r.updated_by}`}</div>
              </div>
              <div className="text-xs text-slate-400">{dateTimeFmt(r.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}