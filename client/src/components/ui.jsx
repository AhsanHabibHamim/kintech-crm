import { useState } from 'react';
import { STATUS_META, TAG_META } from '../utils/format.js';

export function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={`animate-spin ${className} text-current`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Loader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
      <Spinner className="w-7 h-7 text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = '📭', title = 'Nothing here yet', hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 grid place-items-center text-3xl mb-4">{icon}</div>
      <div className="font-semibold text-slate-700">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}

export function TagBadge({ tag }) {
  const m = TAG_META[tag] || { label: tag, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
  return <span className={`badge ${m.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
}

export function ProgressBar({ value, max, label }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className="w-full">
      {label && <div className="flex justify-between text-xs text-slate-500 mb-1.5"><span>{label}</span><span className="tabular font-medium text-slate-600">{value}/{max}</span></div>}
      <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden ring-1 ring-inset ring-black/5">
        <div className="h-full rounded-full bg-brand-grad shadow-glow transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, tone = 'brand' }) {
  const tones = {
    brand: 'text-brand-600', amber: 'text-amber-600', emerald: 'text-emerald-600', rose: 'text-rose-600', sky: 'text-sky-600', slate: 'text-slate-700',
  };
  return (
    <div className="card p-4 sm:p-5 group hover:shadow-glow transition-shadow duration-300">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`font-display text-2xl sm:text-[26px] font-extrabold tabular mt-1.5 ${tones[tone]} truncate tracking-tight`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white/95 backdrop-blur-xl w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} rounded-t-3xl sm:rounded-3xl shadow-glow-lg border border-white/70 max-h-[92vh] overflow-y-auto pb-safe`}>
        <div className="sticky top-0 bg-white/70 backdrop-blur border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <h3 className="font-display font-bold text-slate-800 tracking-tight">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function PageTitle({ title, sub, actions }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, total, limit = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <button className="btn-ghost !px-3 !py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span className="text-xs text-slate-500 tabular">Page {page} of {pages}</span>
      <button className="btn-ghost !px-3 !py-1.5 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }) {
  return (
    <input className="input !py-2 max-w-xs" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

export function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? '' : o.value)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
            value === o.value
              ? 'text-white shadow-glow bg-brand-grad'
              : 'bg-white/70 border border-slate-200 text-slate-600 hover:bg-white hover:border-brand-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-3 text-sm">
      <span className={`w-11 h-6 rounded-full transition relative shadow-inner ${checked ? 'bg-brand-600 shadow-glow' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const node = state ? (
    <Modal open title={state.title || 'Are you sure?'} onClose={() => { setState(null); state.resolve(false); }}>
      <p className="text-sm text-slate-600">{state.message}</p>
      <div className="flex gap-2 mt-5 justify-end">
        <button className="btn-ghost" onClick={() => { setState(null); state.resolve(false); }}>Cancel</button>
        <button className={state.danger ? 'btn-danger' : 'btn-primary'} onClick={() => { setState(null); state.resolve(true); }}>{state.confirmText || 'Confirm'}</button>
      </div>
    </Modal>
  ) : null;
  return { confirm, node };
}

export { initials } from '../utils/format.js';