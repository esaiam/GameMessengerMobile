/**
 * Supabase API base URL for boot (index.js must import this before App).
 * Prefer EXPO_PUBLIC_SUPABASE_URL; fallback = прямой проект (синхронно с eas.json env).
 *
 * Кастомный домен (напр. api.esaiam.ru) без корректного WSS на /realtime/v1/websocket
 * даёт CHANNEL_ERROR на Presence/postgres_changes — не использовать как fallback.
 */
export const DEFAULT_SUPABASE_FALLBACK_URL =
  'https://nqssqplizwsukowggzxd.supabase.co';

function stripTrailingSlashes(url) {
  return typeof url === 'string' ? url.replace(/\/+$/, '') : '';
}

function pickVaultSupabaseUrl() {
  const fromEnv = stripTrailingSlashes(process.env.EXPO_PUBLIC_SUPABASE_URL);
  return fromEnv || DEFAULT_SUPABASE_FALLBACK_URL;
}

if (typeof globalThis !== 'undefined') {
  globalThis.__VAULT_SUPABASE_URL__ = pickVaultSupabaseUrl();
}

/** @deprecated kept for compatibility; URL is set synchronously on import */
export async function resolveSupabaseBaseUrl() {
  return pickVaultSupabaseUrl();
}
