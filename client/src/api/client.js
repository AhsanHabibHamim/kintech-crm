export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const BASE = API_BASE;

export function resolveUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  const origin = API_BASE === '/api' ? '' : new URL(API_BASE).origin;
  return url.startsWith('/') ? `${origin}${url}` : url;
}

let accessToken = localStorage.getItem('kt_access') || '';

export function setAccessToken(t) {
  accessToken = t || '';
  if (t) localStorage.setItem('kt_access', t);
  else localStorage.removeItem('kt_access');
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 30000);
  try {
    const res = await fetch(BASE + path, { method, headers, body: payload, signal: controller.signal });
    if (res.status === 401 && !opts._retried) {
      const ok = await tryRefresh();
      if (ok) return request(method, path, body, { ...opts, _retried: true });
    }
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('Network request timed out. Check your connection.', 408);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefresh() {
  const refreshToken = localStorage.getItem('kt_refresh');
  if (!refreshToken) return false;
  try {
    const res = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.access_token);
    if (data.refresh_token) localStorage.setItem('kt_refresh', data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b, o),
  patch: (p, b, o) => request('PATCH', p, b, o),
  put: (p, b, o) => request('PUT', p, b, o),
  del: (p, b, o) => request('DELETE', p, b, o),
};

export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Download a file (CSV etc.) via the authenticated API. Triggers a browser save. */
export async function downloadFile(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(BASE + path, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    });
    if (res.status === 401 && !res.url.includes('/auth/refresh')) {
      const ok = await tryRefresh();
      if (ok) return downloadFile(path);
    }
    if (!res.ok) {
      const text = await res.text();
      let msg = `Download failed (${res.status}).`;
      try { msg = JSON.parse(text).message || msg; } catch { /* html */ }
      throw new ApiError(msg, res.status);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const m = disposition.match(/filename="?([^";]+)"?/);
    const filename = m ? m[1] : path.split('/').pop().split('?')[0] || `download-${Date.now()}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('Download timed out. Try again.', 408);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}