export function taka(n) {
  const v = Number(n || 0);
  return `৳${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function dateFmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTimeFmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return dateFmt(iso);
}

export const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600' },
  under_review: { label: 'Under Review', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
  needs_info: { label: 'Needs Info', cls: 'bg-indigo-100 text-indigo-700' },
};

export const TAG_META = {
  likely_valid: { label: 'Likely Valid', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  likely_invalid: { label: 'Likely Invalid', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  needs_review: { label: 'Needs Review', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
};

export function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function monthKey(month) {
  return new Date(String(month).trim().length === 7 ? `${month}-01` : month).toLocaleDateString('en-GB', { month: 'short' });
}