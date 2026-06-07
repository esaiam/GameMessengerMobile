import * as SecureStore from 'expo-secure-store';
import {
  ready,
  crypto_box_keypair,
} from 'react-native-libsodium';
import { normalizeVaultPlayerName } from '../lib/vaultPlayerName';

export type KeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

const LEGACY_STORE_KEY_PUBLIC = 'vault_identity_pk';
const LEGACY_STORE_KEY_SECRET = 'vault_identity_sk';

export function encodeKey(key: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < key.length; i++) {
    binary += String.fromCharCode(key[i]);
  }
  return btoa(binary);
}

export function decodeKey(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function requirePlayerName(playerName: string): string {
  const handle = normalizeVaultPlayerName(playerName);
  if (!handle) {
    throw new Error('VaultKeyStore: playerName обязателен');
  }
  return handle;
}

function secureStoreKeySuffix(playerName: string): string {
  const handle = requirePlayerName(playerName);
  const safe = handle.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe) {
    throw new Error('VaultKeyStore: handle не даёт безопасный ключ SecureStore');
  }
  return safe;
}

function storeKeysForHandle(playerName: string) {
  const suffix = secureStoreKeySuffix(playerName);
  return {
    public: `vault_identity_pk.${suffix}`,
    secret: `vault_identity_sk.${suffix}`,
  };
}

async function migrateLegacyKeysToHandle(playerName: string): Promise<KeyPair | null> {
  const keys = storeKeysForHandle(playerName);
  const legacyPk = await SecureStore.getItemAsync(LEGACY_STORE_KEY_PUBLIC);
  const legacySk = await SecureStore.getItemAsync(LEGACY_STORE_KEY_SECRET);
  if (!legacyPk || !legacySk) return null;

  await SecureStore.setItemAsync(keys.public, legacyPk);
  await SecureStore.setItemAsync(keys.secret, legacySk);
  await SecureStore.deleteItemAsync(LEGACY_STORE_KEY_PUBLIC);
  await SecureStore.deleteItemAsync(LEGACY_STORE_KEY_SECRET);

  return {
    publicKey: decodeKey(legacyPk),
    secretKey: decodeKey(legacySk),
  };
}

/**
 * Генерирует новую пару ключей X25519 для @handle, сохраняет в SecureStore
 * и возвращает KeyPair.
 */
export async function generateAndStoreKeyPair(playerName: string): Promise<KeyPair> {
  await ready;
  const keypair = crypto_box_keypair();
  const keys = storeKeysForHandle(playerName);
  await SecureStore.setItemAsync(keys.public, encodeKey(keypair.publicKey));
  await SecureStore.setItemAsync(keys.secret, encodeKey(keypair.privateKey));
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.privateKey,
  };
}

/**
 * Загружает ключевую пару @handle из SecureStore.
 * Возвращает null, если ключи отсутствуют.
 */
export async function loadKeyPair(playerName: string): Promise<KeyPair | null> {
  const keys = storeKeysForHandle(playerName);
  let pkBase64 = await SecureStore.getItemAsync(keys.public);
  let skBase64 = await SecureStore.getItemAsync(keys.secret);

  if (!pkBase64 || !skBase64) {
    const migrated = await migrateLegacyKeysToHandle(playerName);
    if (migrated) return migrated;
    return null;
  }

  return {
    publicKey: decodeKey(pkBase64),
    secretKey: decodeKey(skBase64),
  };
}

/**
 * Возвращает существующую пару @handle или генерирует новую.
 */
export async function getOrCreateKeyPair(playerName: string): Promise<KeyPair> {
  const existing = await loadKeyPair(playerName);
  if (existing) return existing;
  return generateAndStoreKeyPair(playerName);
}

/**
 * Публичный ключ @handle в base64 для сервера / обмена с собеседником.
 */
export async function getPublicKeyBase64(playerName: string): Promise<string> {
  const keypair = await getOrCreateKeyPair(playerName);
  return encodeKey(keypair.publicKey);
}

/** Удалить ключи @handle (logout с wipe / удаление аккаунта). */
export async function clearStoredKeyPair(playerName?: string | null): Promise<void> {
  if (playerName) {
    const keys = storeKeysForHandle(playerName);
    await SecureStore.deleteItemAsync(keys.public);
    await SecureStore.deleteItemAsync(keys.secret);
  }
  await SecureStore.deleteItemAsync(LEGACY_STORE_KEY_PUBLIC);
  await SecureStore.deleteItemAsync(LEGACY_STORE_KEY_SECRET);
}

export default {
  getOrCreateKeyPair,
  getPublicKeyBase64,
  loadKeyPair,
  clearStoredKeyPair,
};

if (__DEV__) {
  import('./vaultCryptoSmokeTests').then(({ runVaultCryptoTests }) => {
    runVaultCryptoTests();
  });
}
