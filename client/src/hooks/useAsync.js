import { useState, useEffect, useCallback, useRef } from 'react';

/** Simple data-fetching hook with loading/error/data + reload. */
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savedCb = useRef(fn);
  savedCb.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await savedCb.current();
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, deps); // eslint-disable-line
  return { data, loading, error, reload, setData };
}

/** Polling variant — reload on an interval. */
export function usePolling(fn, interval = 15000, deps = []) {
  const r = useAsync(fn, deps);
  const { reload } = r;
  useEffect(() => {
    const t = setInterval(reload, interval);
    return () => clearInterval(t);
  }, [reload, interval]);
  return r;
}