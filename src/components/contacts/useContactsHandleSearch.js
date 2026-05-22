import { useState, useEffect, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { sanitizeHandleSlug, HANDLE_RE } from '../../lib/handleProfile';
import { HANDLE_PREFIX_DEBOUNCE_MS } from './contactsDrawerConstants';

export default function useContactsHandleSearch(nickname, searchQ) {
  const [handleResults, setHandleResults] = useState([]);
  const [handleSearchLoading, setHandleSearchLoading] = useState(false);
  const handleSearchSeqRef = useRef(0);

  const handlePrefixForUi = useMemo(() => {
    const raw = searchQ.trimStart();
    if (!raw.startsWith('@')) return '';
    return sanitizeHandleSlug(raw.slice(1));
  }, [searchQ]);

  useEffect(() => {
    if (!nickname) {
      handleSearchSeqRef.current += 1;
      setHandleResults([]);
      setHandleSearchLoading(false);
      return;
    }

    const raw = searchQ.trimStart();
    if (!raw.startsWith('@')) {
      handleSearchSeqRef.current += 1;
      setHandleResults([]);
      setHandleSearchLoading(false);
      return;
    }

    const slug = sanitizeHandleSlug(raw.slice(1));
    if (slug.length < 2 || !HANDLE_RE.test(slug)) {
      handleSearchSeqRef.current += 1;
      setHandleResults([]);
      setHandleSearchLoading(false);
      return;
    }

    const seq = ++handleSearchSeqRef.current;
    setHandleSearchLoading(true);
    setHandleResults([]);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_profiles_by_handle_prefix', {
          prefix: slug,
          lim: 20,
        });
        if (seq !== handleSearchSeqRef.current) return;
        if (error) {
          setHandleResults([]);
          Alert.alert('Поиск', error.message || 'Не удалось выполнить поиск');
          return;
        }
        const rows = (data || []).filter((r) => r?.handle && r.handle !== nickname);
        setHandleResults(rows);
      } finally {
        if (seq === handleSearchSeqRef.current) setHandleSearchLoading(false);
      }
    }, HANDLE_PREFIX_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      setHandleSearchLoading(false);
    };
  }, [searchQ, nickname]);

  return { handleResults, handleSearchLoading, handlePrefixForUi };
}
