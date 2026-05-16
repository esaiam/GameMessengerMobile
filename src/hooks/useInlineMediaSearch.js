import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LEN = 2;

/**
 * Общий debounce-поиск для `@pic` / `@gif`.
 * @param {string} text
 * @param {{ enabled?: boolean, parseQuery: (t: string) => { query: string } | null, search: (q: string, page: number) => Promise<{ results: unknown[], page: number, hasMore: boolean }> }} opts
 */
export default function useInlineMediaSearch(text, { enabled = true, parseQuery, search }) {
  const parsed = useMemo(
    () => (enabled ? parseQuery(text) : null),
    [text, enabled, parseQuery],
  );
  const active = Boolean(parsed);
  const query = parsed?.query ?? '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setResults([]);
      setLoading(false);
      setError(null);
      setPage(1);
      setHasMore(false);
      return;
    }
    if (query.length < MIN_QUERY_LEN) {
      setResults([]);
      setLoading(false);
      setError(null);
      setPage(1);
      setHasMore(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const data = await search(query, 1);
        if (requestIdRef.current !== reqId) return;
        setResults(data.results);
        setPage(1);
        setHasMore(data.hasMore);
      } catch (e) {
        if (requestIdRef.current !== reqId) return;
        setResults([]);
        setHasMore(false);
        setError(e?.message || 'Ошибка поиска');
      } finally {
        if (requestIdRef.current === reqId) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [active, query, search]);

  const loadMore = useCallback(async () => {
    if (!active || query.length < MIN_QUERY_LEN || loading || !hasMore) return;
    const nextPage = page + 1;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const data = await search(query, nextPage);
      if (requestIdRef.current !== reqId) return;
      setResults((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const item of data.results) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (e) {
      if (requestIdRef.current === reqId) {
        setError(e?.message || 'Ошибка поиска');
      }
    } finally {
      if (requestIdRef.current === reqId) setLoading(false);
    }
  }, [active, query, loading, hasMore, page, search]);

  return {
    active,
    query,
    results,
    loading,
    error,
    hasMore,
    loadMore,
    needsQuery: active && query.length < MIN_QUERY_LEN,
    parsed,
  };
}
