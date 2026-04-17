import * as SecureStore from 'expo-secure-store';
import {
  ready,
  crypto_box_keypair,
} from 'react-native-libsodium';

export type KeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

const STORE_KEY_PUBLIC = 'vault_identity_pk';
const STORE_KEY_SECRET = 'vault_identity_sk';

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

/**
 * Генерирует новую пару ключей X25519, сохраняет оба ключа в SecureStore
 * и возвращает KeyPair.
 */
export async function generateAndStoreKeyPair(): Promise<KeyPair> {
  await ready;
  const keypair = crypto_box_keypair();
  await SecureStore.setItemAsync(STORE_KEY_PUBLIC, encodeKey(keypair.publicKey));
  await SecureStore.setItemAsync(STORE_KEY_SECRET, encodeKey(keypair.privateKey));
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.privateKey,
  };
}

/**
 * Загружает ключевую пару из SecureStore.
 * Возвращает null, если хотя бы один из ключей отсутствует.
 */
export async function loadKeyPair(): Promise<KeyPair | null> {
  const pkBase64 = await SecureStore.getItemAsync(STORE_KEY_PUBLIC);
  const skBase64 = await SecureStore.getItemAsync(STORE_KEY_SECRET);
  if (!pkBase64 || !skBase64) return null;
  return {
    publicKey: decodeKey(pkBase64),
    secretKey: decodeKey(skBase64),
  };
}

/**
 * Возвращает существующую ключевую пару или генерирует новую,
 * если ключи ещё не были созданы.
 */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  const existing = await loadKeyPair();
  if (existing) return existing;
  return generateAndStoreKeyPair();
}

/**
 * Возвращает публичный ключ пользователя в виде base64-строки
 * для отправки на сервер / обмена с собеседником.
 */
export async function getPublicKeyBase64(): Promise<string> {
  const keypair = await getOrCreateKeyPair();
  return encodeKey(keypair.publicKey);
}

export default { getOrCreateKeyPair, getPublicKeyBase64, loadKeyPair };

if (__DEV__) {
  import('./vaultCryptoSmokeTests').then(({ runVaultCryptoTests }) => {
    runVaultCryptoTests();
  });
}
