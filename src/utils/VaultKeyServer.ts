/*
 * ============================================================
 * SQL MIGRATION — выполнить в Supabase SQL Editor один раз
 * ============================================================
 *
 * -- Таблица публичных ключей пользователей
 * create table if not exists vault_public_keys (
 *   id uuid primary key default uuid_generate_v4(),
 *   player_name text not null unique,
 *   public_key_b64 text not null,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 * -- Индекс для быстрого поиска по имени
 * create index if not exists idx_vault_public_keys_player_name
 *   on vault_public_keys(player_name);
 * -- RLS: читать может любой аутентифицированный, писать только себя
 * alter table vault_public_keys enable row level security;
 * create policy "Public keys are readable by everyone"
 *   on vault_public_keys for select using (true);
 * create policy "Users can upsert own public key"
 *   on vault_public_keys for insert with check (true);
 * create policy "Users can update own public key"
 *   on vault_public_keys for update using (true);
 * ============================================================
 */

import { supabase } from '../lib/supabase';
import { getPublicKeyBase64 } from './VaultKeyStore';

const keyCache = new Map<string, string>();

export type PublicKeyRecord = {
  player_name: string;
  public_key_b64: string;
};

/**
 * Публикует публичный ключ текущего пользователя в Supabase.
 * Если запись уже существует — обновляет её (upsert по player_name).
 * При ошибке бросает Error с описанием.
 */
export async function publishMyPublicKey(playerName: string): Promise<void> {
  const public_key_b64 = await getPublicKeyBase64();

  const { error } = await supabase
    .from('vault_public_keys')
    .upsert(
      { player_name: playerName, public_key_b64, updated_at: new Date().toISOString() },
      { onConflict: 'player_name' }
    );

  if (error) {
    throw new Error(`VaultKeyServer: не удалось опубликовать публичный ключ — ${error.message}`);
  }
}

/**
 * Получает публичный ключ пользователя по его player_name.
 * Возвращает base64-строку ключа или null, если пользователь не найден.
 */
export async function fetchPublicKey(playerName: string): Promise<string | null> {
  const cached = keyCache.get(playerName);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('vault_public_keys')
    .select('public_key_b64')
    .eq('player_name', playerName)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`VaultKeyServer: ошибка при получении ключа для «${playerName}» — ${error.message}`);
  }

  const key = data?.public_key_b64 ?? null;
  if (key) keyCache.set(playerName, key);
  return key;
}

/**
 * Получает публичные ключи сразу для нескольких пользователей одним запросом.
 * Возвращает объект { [playerName]: public_key_b64 }.
 * Отсутствующие в базе имена просто не попадут в результат.
 */
export async function fetchPublicKeys(playerNames: string[]): Promise<Record<string, string>> {
  if (playerNames.length === 0) return {};

  const result: Record<string, string> = {};
  const toFetch: string[] = [];

  for (const name of playerNames) {
    const cached = keyCache.get(name);
    if (cached) {
      result[name] = cached;
    } else {
      toFetch.push(name);
    }
  }

  if (toFetch.length === 0) return result;

  const { data, error } = await supabase
    .from('vault_public_keys')
    .select('player_name, public_key_b64')
    .in('player_name', toFetch);

  if (error) {
    throw new Error(`VaultKeyServer: ошибка при массовом получении ключей — ${error.message}`);
  }

  for (const row of data ?? []) {
    keyCache.set(row.player_name, row.public_key_b64);
    result[row.player_name] = row.public_key_b64;
  }

  return result;
}

export default { publishMyPublicKey, fetchPublicKey, fetchPublicKeys };
