import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, Spinner } from '../../components/ui.jsx';
import { taka } from '../../utils/format.js';

export default function ManagerRates() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user?.role === 'super_admin' || user?.permissions?.manage_rates;
  const { data, reload } = useAsync(() => api.get('/manager/rates'), []);
  const [form, setForm] = useState({ type: 'per_lead', amount: '' });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.post('/manager/rates', { type: form.type, amount: Number(form.amount) });
      toast('Rate updated. New approvals use this rate.', 'success');
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const perLead = data?.per_lead;
  const superLead = data?.super_lead;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageTitle title="Commission rates" sub={canManage ? 'Changes apply to future approved leads only.' : 'Viewing only — you need the "manage rates" permission to change these.'} />

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="card p-5">
          <div className="text-xs font-medium text-slate-500">Per approved lead</div>
          <div className="text-3xl font-extrabold text-emerald-600 tabular mt-1">{taka(perLead?.amount)}</div>
          <div className="text-xs text-slate-400 mt-1">{perLead ? `Updated ${new Date(perLead.updated_at).toLocaleDateString()}` : ''}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium text-slate-500">Super Lead bonus</div>
          <div className="text-3xl font-extrabold text-sky-600 tabular mt-1">{taka(superLead?.amount)}</div>
          <div className="text-xs text-slate-400 mt-1">{superLead ? `Updated ${new Date(superLead.updated_at).toLocaleDateString()}` : ''}</div>
        </div>
      </div>

      {canManage && (
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-800">Set a new rate</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="input !py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="per_lead">Per approved lead</option>
              <option value="super_lead">Super Lead bonus</option>
            </select>
            <input className="input !py-2" type="number" inputMode="decimal" step="0.01" placeholder="Amount (৳)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <button className="btn-primary" disabled={busy || !form.amount || Number(form.amount) <= 0} onClick={save}>
              {busy ? <Spinner className="w-4 h-4" /> : 'Save rate'}
            </button>
          </div>
          <p className="text-xs text-slate-400">Rates are history-tracked: each approved lead is credited at the rate in effect at that time. Referral override stays 5% of the per-lead rate.</p>
        </div>
      )}
    </div>
  );
}