import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { api } from '../../api/client.js';
import { useToast } from '../../hooks/useToast.jsx';
import { PageTitle, Spinner, Field } from '../../components/ui.jsx';

export default function AdminSettings() {
  const toast = useToast();
  const { data, reload } = useAsync(() => api.get('/admin/settings'), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const d = data || {};

  const f = form ?? (d.withdrawal_thresholds || { first: '', subsequent: '' });

  async function save() {
    setBusy(true);
    try {
      await api.post('/admin/settings', {
        withdrawal_thresholds: {
          first: Number(f.first),
          subsequent: Number(f.subsequent),
        },
        referral_override_percent: Number(f.referral_override_percent),
        lead_followup_days: Number(f.lead_followup_days),
      });
      toast('Settings saved.', 'success');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const val = (k, fallback) => form ? form[k] : d[k] ?? fallback;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageTitle title="Settings" sub="Withdrawal thresholds and feature configuration." />
      {!d.withdrawal_thresholds && d.referral_override_percent === undefined && <p className="text-sm text-slate-400">Loading…</p>}
      <div className="card p-5 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="First withdrawal (approved leads)" hint="An agent's first payout unlocks at this many approved leads.">
            <input className="input" type="number" min="1" value={val('first', '')} onChange={(e) => setForm({ ...form, first: e.target.value })} />
          </Field>
          <Field label="Subsequent withdrawals (approved leads)" hint="Every new payout unlocks after this many additional approvals.">
            <input className="input" type="number" min="1" value={val('subsequent', '')} onChange={(e) => setForm({ ...form, subsequent: e.target.value })} />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Referral override (%)" hint="Referrer earns this % of the referred agent's per-lead commission on their first 50 approvals.">
            <input className="input" type="number" min="0" max="100" step="0.5" value={val('referral_override_percent', '')} onChange={(e) => setForm({ ...form, referral_override_percent: e.target.value })} />
          </Field>
          <Field label="Lead follow-up flag (days)" hint="Approved leads with no further action get flagged after this many days.">
            <input className="input" type="number" min="1" value={val('lead_followup_days', '')} onChange={(e) => setForm({ ...form, lead_followup_days: e.target.value })} />
          </Field>
        </div>
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Spinner className="w-4 h-4" /> : 'Save settings'}</button>
      </div>
    </div>
  );
}