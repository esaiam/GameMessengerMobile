import { supabase } from './supabase';
import { invokeVaultEdgeFunction } from './edgeFunctions';
import { fetchGiphyTrendingDirect, searchGiphyDirect } from './giphySearch';

const GIPHY_CLIENT_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';

async function searchViaEdgeFunction(query, page, accessToken, { trending = false } = {}) {
  const params = new URLSearchParams({ page: String(page) });
  if (trending) {
    params.set('trending', '1');
  } else {
    params.set('q', query);
  }
  const res = await invokeVaultEdgeFunction('search-gif', accessToken, undefined, {
    method: 'GET',
    query: Object.fromEntries(params),
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
    hasMore: Boolean(body.hasMore) };
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
    data: { session } } = await supabase.auth.getSession();
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

async function fetchTrendingDirect(page) {
  if (!GIPHY_CLIENT_KEY) return null;
  return fetchGiphyTrendingDirect(page, GIPHY_CLIENT_KEY);
}

/**
 * @param {number} [page]
 */
export async function fetchTrendingGifs(page = 1) {
  const {
    data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Войдите в аккаунт для GIF');
  }

  try {
    const data = await searchViaEdgeFunction('', page, session.access_token, { trending: true });
    if (data.results.length > 0) return data;
    const direct = await fetchTrendingDirect(page);
    if (direct?.results?.length) {
      if (__DEV__) {
        console.warn('[Vault] search-gif trending empty, using EXPO_PUBLIC_GIPHY_API_KEY');
      }
      return direct;
    }
    if (data.results.length === 0) {
      throw new Error(
        'Популярные GIF недоступны.\n' +
          'supabase functions deploy search-gif\n' +
          'или EXPO_PUBLIC_GIPHY_API_KEY в .env',
      );
    }
    return data;
  } catch (edgeErr) {
    const status = edgeErr?.status;
    const direct = await fetchTrendingDirect(page);
    if (direct?.results?.length) {
      if (__DEV__) {
        console.warn('[Vault] search-gif trending edge failed, using EXPO_PUBLIC_GIPHY_API_KEY', status);
      }
      return direct;
    }
    const canFallback =
      GIPHY_CLIENT_KEY && (status === 404 || status === 503 || status === 502);
    if (canFallback) {
      return fetchGiphyTrendingDirect(page, GIPHY_CLIENT_KEY);
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
