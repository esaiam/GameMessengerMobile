import { useCallback } from 'react';
import { parsePicInlineQuery } from '../lib/parsePicInlineQuery';
import { searchInlineImages } from '../lib/searchInlineImages';
import useInlineMediaSearch from './useInlineMediaSearch';

/** Inline-поиск картинок при вводе `@pic …`. */
export default function usePicInlineSearch(text, { enabled = true } = {}) {
  const parseQuery = useCallback((t) => parsePicInlineQuery(t), []);
  const search = useCallback((q, page) => searchInlineImages(q, page), []);
  return useInlineMediaSearch(text, { enabled, parseQuery, search });
}
