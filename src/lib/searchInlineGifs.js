import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { searchGiphyDirect } from './giphySearch';

const GIPHY_CLIENT_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';

async function searchViaEdgeFunction(query, page, accessToken) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  const url = `${SUPABASE_URL}/functions/v1/search-gif?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const err = new Error(
      typeof body?.error === 'string'
        ? body.error
        : res.status === 404
          ? 'Функция search-gif не развёрнута'
          : res.status === 503
            ? 'GIPHY_API_KEY не задан на сервере'
            : `Ошибка поиска GIF (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }

  return {
    results: Array.isArray(body.results) ? body.results : [],
    page: typeof body.page === 'number' ? body.page : page,
    hasMore: Boolean(body.hasMore),
  };
}

/**
 * @param {string} query
 * @param {number} [page]
 */
export async function searchInlineGifs(query, page = 1) {
  const q = String(query || '').trim();
  if (q.length < 2) {
    return { results: [], page: 1, hasMore: false };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Войдите в аккаунт для поиска GIF');
  }

  try {
    return await searchViaEdgeFunction(q, page, session.access_token);
  } catch (edgeErr) {
    const status = edgeErr?.status;
    const canFallback =
      GIPHY_CLIENT_KEY && (status === 404 || status === 503 || status === 502);
    if (canFallback) {
      if (__DEV__) {
        console.warn('[Vault] search-gif edge failed, using EXPO_PUBLIC_GIPHY_API_KEY', status);
      }
      return searchGiphyDirect(q, page, GIPHY_CLIENT_KEY);
    }
    if (status === 503) {
      throw new Error(
        'Задайте GIPHY_API_KEY: supabase secrets set GIPHY_API_KEY=…\n' +
          'Или для разработки: EXPO_PUBLIC_GIPHY_API_KEY в .env',
      );
    }
    throw edgeErr;
  }
}
