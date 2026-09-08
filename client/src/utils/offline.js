// Offline lead form caching: saves drafts to localStorage and syncs when back online.

const KEY = 'kt_offline_leads';

export const OFFLINE = {
  list: () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  },
  push: (lead) => {
    try {
      const all = OFFLINE.list();
      all.push({ ...lead, _queued_at: new Date().toISOString(), _id: Date.now() + Math.random().toString(16).slice(2) });
      localStorage.setItem(KEY, JSON.stringify(all));
      return all.length;
    } catch { return 0; }
  },
  remove: (id) => {
    const all = OFFLINE.list().filter((l) => l._id !== id);
    localStorage.setItem(KEY, JSON.stringify(all));
    return all;
  },
  clear: () => localStorage.removeItem(KEY),
};

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeOnline(fn) {
  const on = () => fn(true);
  const off = () => fn(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
}