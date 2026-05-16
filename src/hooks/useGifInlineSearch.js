import { useCallback } from 'react';
import { parseGifInlineQuery } from '../lib/parseGifInlineQuery';
import { searchInlineGifs } from '../lib/searchInlineGifs';
import useInlineMediaSearch from './useInlineMediaSearch';

/** Inline-поиск GIF при вводе `@gif …`. */
export default function useGifInlineSearch(text, { enabled = true } = {}) {
  const parseQuery = useCallback((t) => parseGifInlineQuery(t), []);
  const search = useCallback((q, page) => searchInlineGifs(q, page), []);
  return useInlineMediaSearch(text, { enabled, parseQuery, search });
}
