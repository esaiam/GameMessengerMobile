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
import { normalizeVaultPlayerName } from '../lib/vaultPlayerName';
import {
  encodeKey,
  generateAndStoreKeyPair,
  getPublicKeyBase64,
  loadKeyPair,
  clearStoredKeyPair,
} from './VaultKeyStore';

const keyCache = new Map<string, string>();

export function clearPublicKeyCache(): void {
  keyCache.clear();
}

export function getKeyFromCache(playerName: string): string | null {
  const name = normalizeVaultPlayerName(playerName);
  if (!name) return null;
  return keyCache.get(name) ?? null;
}

export type PublicKeyRecord = {
  player_name: string;
  public_key_b64: string;
};

function cachePublicKey(playerName: string, publicKeyB64: string): void {
  const name = normalizeVaultPlayerName(playerName);
  if (name && publicKeyB64) keyCache.set(name, publicKeyB64);
}

async function upsertPublicKey(playerName: string, public_key_b64: string): Promise<void> {
  const name = normalizeVaultPlayerName(playerName);
  if (!name) {
    throw new Error('VaultKeyServer: playerName обязателен');
  }

  const { error } = await supabase
    .from('vault_public_keys')
    .upsert(
      { player_name: name, public_key_b64, updated_at: new Date().toISOString() },
      { onConflict: 'player_name' }
    );

  if (error) {
    throw new Error(`VaultKeyServer: не удалось опубликовать публичный ключ — ${error.message}`);
  }

  cachePublicKey(name, public_key_b64);
}

/**
 * Ключи текущего @handle при входе.
 * Сервер — источник правды для других устройств; не перезаписываем чужой pubkey.
 */
export async function ensureUserIdentityKeys(playerName: string): Promise<void> {
  const name = normalizeVaultPlayerName(playerName);
  if (!name) return;

  const serverPub = await fetchPublicKey(name);
  const local = await loadKeyPair(name);

  if (local) {
    const localPub = encodeKey(local.publicKey);
    if (!serverPub) {
      await upsertPublicKey(name, localPub);
      return;
    }
    if (serverPub !== localPub) {
      // Устаревшая локальная пара (pre-provision на этом устройстве) — сервер с другого девайса.
      await clearStoredKeyPair(name);
    }
    return;
  }

  if (serverPub) {
    // Private key для serverPub на этом устройстве нет — без backup расшифровка невозможна.
    return;
  }

  await generateAndStoreKeyPair(name);
  await upsertPublicKey(name, await getPublicKeyBase64(name));
}

/**
 * Публичный ключ получателя для шифрования.
 * 1) сервер (мульти-девайс), 2) локальный, 3) bootstrap если нигде нет.
 */
export async function resolveRecipientPublicKeyB64(recipientPlayerName: string): Promise<string | null> {
  const name = normalizeVaultPlayerName(recipientPlayerName);
  if (!name) return null;

  const serverPub = await fetchPublicKey(name);
  if (serverPub) return serverPub;

  const local = await loadKeyPair(name);
  if (local) {
    const pub = encodeKey(local.publicKey);
    await upsertPublicKey(name, pub);
    return pub;
  }

  const pair = await generateAndStoreKeyPair(name);
  const pub = encodeKey(pair.publicKey);
  await upsertPublicKey(name, pub);
  return pub;
}

/**
 * Публикует публичный ключ текущего пользователя в Supabase.
 * Если запись уже существует — обновляет её (upsert по player_name).
 * При ошибке бросает Error с описанием.
 */
export async function publishMyPublicKey(playerName: string): Promise<void> {
  const public_key_b64 = await getPublicKeyBase64(playerName);
  await upsertPublicKey(playerName, public_key_b64);
}

/**
 * Получает публичный ключ пользователя по его player_name.
 * Возвращает base64-строку ключа или null, если пользователь не найден.
 */
export async function fetchPublicKey(playerName: string): Promise<string | null> {
  const name = normalizeVaultPlayerName(playerName);
  if (!name) return null;

  const cached = keyCache.get(name);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('vault_public_keys')
    .select('public_key_b64')
    .eq('player_name', name)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`VaultKeyServer: ошибка при получении ключа для «${name}» — ${error.message}`);
  }

  const key = data?.public_key_b64 ?? null;
  if (key) cachePublicKey(name, key);
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

  for (const raw of playerNames) {
    const name = normalizeVaultPlayerName(raw);
    if (!name) continue;
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
    cachePublicKey(row.player_name, row.public_key_b64);
    result[row.player_name] = row.public_key_b64;
  }

  return result;
}

export default {
  ensureUserIdentityKeys,
  resolveRecipientPublicKeyB64,
  publishMyPublicKey,
  fetchPublicKey,
  fetchPublicKeys,
};
