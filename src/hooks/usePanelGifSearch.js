import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTrendingGifs, searchInlineGifs } from '../lib/searchInlineGifs';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LEN = 2;

/** Поиск и trending GIF в панели эмодзи (отдельно от `@gif` в поле ввода). */
export default function usePanelGifSearch(query, { enabled = true } = {}) {
  const q = String(query || '').trim();
  const isSearch = q.length >= MIN_QUERY_LEN;

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestIdRef = useRef(0);

  const [trendingResults, setTrendingResults] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState(null);
  const [trendingPage, setTrendingPage] = useState(1);
  const [trendingHasMore, setTrendingHasMore] = useState(false);
  const trendingRequestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      setLoading(false);
      setError(null);
      setPage(1);
      setHasMore(false);
      return;
    }
    if (!isSearch) {
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
        const data = await searchInlineGifs(q, 1);
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
  }, [enabled, isSearch, q]);

  useEffect(() => {
    if (!enabled || isSearch) {
      setTrendingResults([]);
      setTrendingLoading(false);
      setTrendingError(null);
      setTrendingPage(1);
      setTrendingHasMore(false);
      return;
    }

    const reqId = ++trendingRequestIdRef.current;
    setTrendingLoading(true);
    setTrendingError(null);

    (async () => {
      try {
        const data = await fetchTrendingGifs(1);
        if (trendingRequestIdRef.current !== reqId) return;
        setTrendingResults(data.results);
        setTrendingPage(1);
        setTrendingHasMore(data.hasMore);
      } catch (e) {
        if (trendingRequestIdRef.current !== reqId) return;
        setTrendingResults([]);
        setTrendingHasMore(false);
        setTrendingError(e?.message || 'Не удалось загрузить GIF');
      } finally {
        if (trendingRequestIdRef.current === reqId) setTrendingLoading(false);
      }
    })();
  }, [enabled, isSearch]);

  const loadMore = useCallback(async () => {
    if (!enabled || !isSearch || loading || !hasMore) return;
    const nextPage = page + 1;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const data = await searchInlineGifs(q, nextPage);
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
  }, [enabled, isSearch, q, loading, hasMore, page]);

  const loadMoreTrending = useCallback(async () => {
    if (!enabled || isSearch || trendingLoading || !trendingHasMore) return;
    const nextPage = trendingPage + 1;
    const reqId = ++trendingRequestIdRef.current;
    setTrendingLoading(true);
    try {
      const data = await fetchTrendingGifs(nextPage);
      if (trendingRequestIdRef.current !== reqId) return;
      setTrendingResults((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const item of data.results) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTrendingPage(nextPage);
      setTrendingHasMore(data.hasMore);
    } catch (e) {
      if (trendingRequestIdRef.current === reqId) {
        setTrendingError(e?.message || 'Не удалось загрузить GIF');
      }
    } finally {
      if (trendingRequestIdRef.current === reqId) setTrendingLoading(false);
    }
  }, [enabled, isSearch, trendingLoading, trendingHasMore, trendingPage]);

  return {
    results,
    trendingResults,
    loading: isSearch ? loading : trendingLoading,
    error: isSearch ? error : trendingError,
    hasMore: isSearch ? hasMore : trendingHasMore,
    loadMore: isSearch ? loadMore : loadMoreTrending,
    needsQuery: enabled && q.length < MIN_QUERY_LEN };
}
