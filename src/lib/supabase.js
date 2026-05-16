import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VAULT_AUTH_KEY } from './vaultAuthStorageKey';
import { DEFAULT_SUPABASE_FALLBACK_URL } from './resolveSupabaseBaseUrl';

const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error('Supabase env variables are not set. Check your .env file.');
}

function readProbedSupabaseUrl() {
  try {
    const u = globalThis.__VAULT_SUPABASE_URL__;
    if (typeof u === 'string' && u.length > 0) {
      return u.replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }
  return null;
}

export const SUPABASE_URL =
  readProbedSupabaseUrl() ||
  (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '') ||
  DEFAULT_SUPABASE_FALLBACK_URL;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    storageKey: VAULT_AUTH_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

if (__DEV__ && /api\.esaiam\.ru/i.test(SUPABASE_URL)) {
  console.warn(
    '[Vault][dev] SUPABASE_URL на api.esaiam.ru: Realtime (Presence, live-чат) часто падает без WSS-прокси. ' +
      'Для локалки задай EXPO_PUBLIC_SUPABASE_URL=https://nqssqplizwsukowggzxd.supabase.co или проксируй /realtime/v1/websocket.'
  );
}

if (__DEV__) {
  /** GoTrue health — не путать с GET /auth/v1/ (часто 404, это не сеть). */
  const healthUrl = `${SUPABASE_URL}/auth/v1/health`;
  const restUrl = `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`;
  const hdr = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  console.log('[Vault][dev] SUPABASE_URL =', SUPABASE_URL);

  fetch(healthUrl, { method: 'GET', headers: hdr })
    .then(async (res) => {
      const body = await res.text().catch(() => '');
      console.log(
        '[Vault][dev] Supabase health',
        healthUrl,
        '->',
        res.status,
        body ? body.slice(0, 120).replace(/\s+/g, ' ') : ''
      );
    })
    .catch((err) => {
      console.warn('[Vault][dev] Supabase health probe FAILED:', err?.message || String(err));
    });

  /** Тот же путь, что у списка чатов (PostgREST), без supabase-js-обёртки. */
  fetch(restUrl, { method: 'GET', headers: { ...hdr, Accept: 'application/json' } })
    .then(async (res) => {
      const body = await res.text().catch(() => '');
      console.log(
        '[Vault][dev] Supabase REST profiles',
        '->',
        res.status,
        body ? body.slice(0, 160).replace(/\s+/g, ' ') : ''
      );
    })
    .catch((err) => {
      console.warn('[Vault][dev] Supabase REST probe FAILED:', err?.message || String(err));
    });
}
