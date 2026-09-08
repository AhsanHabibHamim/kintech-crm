import { useState } from 'react';
import { Modal, StatusBadge, TagBadge, Spinner } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { dateTimeFmt, timeAgo } from '../utils/format.js';
import LeadForm from './LeadForm.jsx';

const AGENT_EDITABLE = ['pending', 'under_review', 'needs_info'];

export default function LeadDetailModal({ lead, onClose, canReview, onChanged, standalone = false }) {
  const { isManager, isAdmin, isAgent } = useAuth();
  const toast = useToast();
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [editing, setEditing] = useState(false);
  const [withinReview, setWithinReview] = useState(false);

  const notes = lead?.auto_validation_notes || {};

  const canEdit = isAgent ? AGENT_EDITABLE.includes(lead?.status) : canReview;
  const staffRole = isAdmin ? 'admin' : isManager ? 'manager' : 'agent';

  async function doReview(next, payload = {}) {
    setBusy(true);
    try {
      await api.post(`/review/${lead.id}`, { action: next, reason, ...payload });
      toast(next === 'approved' ? 'Lead approved — commission credited.' : next === 'rejected' ? 'Lead rejected.' : 'Marked as needs more info.', next === 'rejected' ? 'error' : 'success');
      onChanged && onChanged();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doSuperLead() {
    setBusy(true);
    try {
      await api.post(`/review/${lead.id}/super-lead`);
      toast('Super Lead bonus credited 🎉', 'success');
      onChanged && onChanged();
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doDispute() {
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/dispute`, { note: disputeNote });
      toast('Dispute filed — a moderator will re-review.', 'success');
      setShowDispute(false);
      onChanged && onChanged();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!lead) return <Modal open onClose={onClose} title="Lead"> </Modal>;

  if (editing) {
    return (
      <Modal open onClose={onClose} title={`✎ Edit lead #${lead.id} · ${lead.client_name}`} wide>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={lead.status} />
            <span className="badge bg-slate-100 text-slate-600">{canReview ? 'Editing as moderator — any lead, any time' : 'Editing — save resubmits for review'}</span>
          </div>
          <LeadForm initial={lead} onSubmitted={() => { setEditing(false); onChanged && onChanged(); onClose(); }} />
          <div className="text-center">
            <button className="text-xs text-slate-400 underline hover:text-slate-600" onClick={() => setEditing(false)}>Cancel edit</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Lead #${lead.id} · ${lead.client_name}`} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={lead.status} />
          <TagBadge tag={lead.auto_validation_tag} />
          {lead.is_super_lead && <span className="badge bg-sky-100 text-sky-700">🏆 Super Lead</span>}
          {lead.dispute_requested && <span className="badge bg-amber-100 text-amber-700">⚖️ Disputed</span>}
          {lead.followup_flag && <span className="badge bg-orange-100 text-orange-700">⏱ Follow-up needed</span>}
        </div>

        {isAgent && lead.status === 'needs_info' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <div className="font-semibold text-amber-800 flex items-center gap-1.5">📝 Admin asked for more information</div>
            {lead.info_request && <div className="text-amber-700 mt-1">“{lead.info_request}”</div>}
            {!lead.info_request && <div className="text-amber-700 mt-1">Update the lead with the missing details and resubmit for review.</div>}
            <button className="btn-primary !px-4 !py-2 mt-3" onClick={() => setEditing(true)}>✎ Edit lead & resubmit</button>
          </div>
        )}

        {canEdit && !(isAgent && lead.status === 'needs_info') && (
          <div className="flex justify-end">
            <button className="btn-soft !py-2" onClick={() => setEditing(true)}>✎ Edit lead</button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <KV k="Client name" v={lead.client_name} />
          <KV k="Email" v={lead.email} />
          <KV k="WhatsApp" v={lead.whatsapp_number} />
          <KV k="Category" v={lead.category || '—'} />
          <KV k="Sub-service" v={lead.sub_service || '—'} />
          <KV k="Client niche" v={lead.client_niche || '—'} />
          <KV k="Service note" v={lead.service_interested_in} />
          <KV k="Website" v={lead.website_url || '—'} link />
          <KV k="Location" v={lead.location || '—'} />
          <KV k="Submitted" v={`${dateTimeFmt(lead.created_at)} (${timeAgo(lead.created_at)})`} />
          <KV k="Reviewed" v={lead.reviewed_at ? dateTimeFmt(lead.reviewed_at) : '—'} />
          <KV k="Assigned by" v={lead.agent_name ? `${lead.agent_name} (ID ${lead.agent_id ?? '-'})` : '—'} />
        </div>

        {lead.status === 'approved' && lead.reviewer_name && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <span>✓</span><span><b>Accepted by {lead.reviewer_name}</b>{lead.reviewed_by ? ` (ID ${lead.reviewed_by})` : ''} · {lead.reviewed_at ? dateTimeFmt(lead.reviewed_at) : ''}</span>
          </div>
        )}

        {Array.isArray(lead.social_links) && lead.social_links.length > 0 && (
          <div className="text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Social links</div>
            <div className="flex flex-wrap gap-2">
              {lead.social_links.map((s, i) => (
                <a key={i} className="badge bg-sky-50 text-sky-700 border border-sky-200 break-all" href={/^https?:\/\//i.test(s) ? s : `https://${s}`} target="_blank" rel="noreferrer">
                  {s.replace(/^https?:\/\//i, '').replace(/\/$/, '')} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        {lead.rejection_reason && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-sm">
            <div className="font-semibold text-rose-700">Rejection reason</div>
            <div className="text-rose-600 mt-0.5">{lead.rejection_reason}</div>
          </div>
        )}

        {lead.dispute_note && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-sm">
            <div className="font-semibold text-amber-700">Dispute note (from agent)</div>
            <div className="text-amber-600 mt-0.5">{lead.dispute_note}</div>
          </div>
        )}

        <ValidationNotes notes={notes} fraudFlags={lead.fraud_flags} />

        <ActivityTimeline lead={lead} />

        {/* Agent: dispute request */}
        {isAgent && lead.status === 'rejected' && !lead.dispute_requested && (
          <div>
            {!showDispute ? (
              <button className="btn-ghost" onClick={() => setShowDispute(true)}>⚖️ Dispute this rejection</button>
            ) : (
              <div className="space-y-2">
                <textarea className="input" rows={3} placeholder="Explain why this lead should be re-reviewed…" value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy || disputeNote.trim().length < 5} onClick={doDispute}>{busy ? <Spinner className="w-4 h-4" /> : 'File dispute'}</button>
                  <button className="btn-ghost" onClick={() => setShowDispute(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Moderator: review actions */}
        {canReview && ['pending', 'under_review', 'needs_info'].includes(lead.status) && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            {action === 'rejected' && (
              <textarea className="input" rows={2} placeholder="Rejection reason (required) — helps the agent improve…" value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn-success" disabled={busy} onClick={() => doReview('approved')}>{busy ? <Spinner className="w-4 h-4" /> : '✓ Approve'}</button>
              <button className="btn-danger" disabled={busy} onClick={() => { if (action !== 'rejected') setAction('rejected'); else doReview('rejected'); }}>
                ✕ Reject
              </button>
              <button className="btn-ghost" disabled={busy} onClick={() => doReview('needs_info')}>More info</button>
            </div>
          </div>
        )}

        {/* Moderator: super lead mark */}
        {canReview && lead.status === 'approved' && !lead.is_super_lead && (
          <div className="border-t border-slate-100 pt-4">
            <button className="btn-primary" disabled={busy} onClick={doSuperLead}>🏆 Mark as Super Lead (client converted)</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function KV({ k, v, link }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</div>
      {link && v !== '—' ? <a className="text-brand-600 break-all" href={v} target="_blank" rel="noreferrer"><span className="text-slate-700">{v}</span> ↗</a> : <div className="text-slate-700 break-all">{v}</div>}
    </div>
  );
}

function ValidationNotes({ notes, fraudFlags }) {
  const hasNotes = notes && (notes.spam?.length || notes.website_check || notes.location_check || notes.whatsapp_check || notes.summary);
  if (!hasNotes && !fraudFlags?.length) return null;
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm">
      <div className="font-semibold text-slate-700 mb-2">🔍 Auto-validation report</div>
      {notes?.summary && <p className="text-slate-600 mb-2 italic">“{notes.summary}”</p>}
      <div className="space-y-1 text-slate-600">
        {notes?.website_check && <Detail name="Website" value={notes.website_check.note} ok={notes.website_check.ok} />}
        {notes?.location_check && notes.location_check.found !== undefined && <Detail name="Location" value={notes.location_check.label ? (notes.location_check.label.slice(0, 80) + ' — ' + notes.location_check.note) : notes.location_check.note} ok={notes.location_check.ok} />}
        {notes?.whatsapp_check && <Detail name="WhatsApp" value={notes.whatsapp_check.note} ok={notes.whatsapp_check.valid} />}
        {notes?.spam?.map((f, i) => <div key={i} className="flex gap-2"><span>🚩</span><span>{f.message}</span></div>)}
      </div>
      {fraudFlags?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <div className="font-semibold text-rose-600 mb-1">Fraud flags</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {fraudFlags.map((f, i) => <li key={i} className="text-rose-600"><b className="font-semibold">{f.code}</b> — {f.message}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Detail({ name, value, ok }) {
  const tone = ok === false ? 'text-rose-600' : ok === true ? 'text-emerald-600' : 'text-slate-600';
  const icon = ok === false ? '✕' : ok === true ? '✓' : '•';
  return <div className={`flex gap-2 ${tone}`}><span>{icon}</span><span><b>{name}:</b> {value}</span></div>;
}

function RoleLabel(role) {
  return role === 'manager' ? 'Manager' : role === 'super_admin' ? 'Admin' : role === 'lead_agent' ? 'Agent' : role || 'Unknown';
}

function ActivityTimeline({ lead }) {
  const events = [];
  events.push({ at: lead.created_at, icon: '🆕', title: 'Lead submitted', sub: lead.agent_name ? `by ${lead.agent_name}` : null });
  (lead.edit_history || []).forEach((h) => {
    const who = (h.editor_name || RoleLabel(h.editor_role));
    events.push({
      at: h.edited_at,
      icon: '✎',
      title: `Edited by ${who}`,
      sub: [
        h.note ? `Note: ${h.note}` : null,
        h.fields?.length ? `Changed: ${h.fields.join(', ')}` : null,
      ].filter(Boolean).join(' · '),
    });
  });
  if (lead.reviewed_at && lead.status !== 'pending') {
    events.push({ at: lead.reviewed_at, icon: '🔍', title: `Reviewed → ${lead.status.replace('_', ' ')}`, sub: lead.reviewer_name ? `by ${lead.reviewer_name}` : null });
  }
  if (lead.super_lead_marked_at) {
    events.push({ at: lead.super_lead_marked_at, icon: '🏆', title: 'Marked as Super Lead' });
  }
  if (lead.dispute_requested || lead.dispute_resolved_at) {
    if (lead.dispute_requested) events.push({ at: lead.reviewed_at || lead.created_at, icon: '⚖️', title: 'Dispute filed', sub: lead.dispute_note || null });
    if (lead.dispute_resolved_at) events.push({ at: lead.dispute_resolved_at, icon: '✅', title: 'Dispute resolved' });
  }
  events.sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm">
      <div className="font-semibold text-slate-700 mb-3">🧾 Lead activity history</div>
      <div className="space-y-0">
        {events.map((ev, i) => (
          <div key={i} className="relative pl-6 pb-4 last:pb-0">
            {i < events.length - 1 && <span className="absolute left-[11px] top-5 bottom-0 w-px bg-slate-200" />}
            <span className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-white border border-slate-200 grid place-items-center text-xs">{ev.icon}</span>
            <div className="text-slate-800 font-medium leading-tight">{ev.title} <span className="text-slate-400 font-normal">· {dateTimeFmt(ev.at)}</span></div>
            {ev.sub && <div className="text-slate-500 text-xs mt-0.5 break-words">{ev.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}