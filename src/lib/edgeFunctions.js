import { DEFAULT_SUPABASE_FALLBACK_URL } from './resolveSupabaseBaseUrl';
import { SUPABASE_ANON_KEY } from './supabase';

/**
 * Edge Functions всегда на *.supabase.co (не кастомный прокси).
 * Auth: user JWT в Authorization + publishable/anon в apikey.
 */
export const SUPABASE_FUNCTIONS_URL = DEFAULT_SUPABASE_FALLBACK_URL;

/**
 * @param {string} functionName
 * @param {string} accessToken
 * @param {Record<string, unknown>} [body]
 * @param {{ method?: string; query?: Record<string, string> }} [opts]
 */
export async function invokeVaultEdgeFunction(
  functionName,
  accessToken,
  body,
  opts = {},
) {
  const method = opts.method || (body !== undefined ? 'POST' : 'GET');
  const params = opts.query ? new URLSearchParams(opts.query) : null;
  const qs = params?.toString();
  const url = `${SUPABASE_FUNCTIONS_URL}/functions/v1/${functionName}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  return res;
}
