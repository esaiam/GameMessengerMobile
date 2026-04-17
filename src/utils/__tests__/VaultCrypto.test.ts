/**
 * Smoke tests для VaultCrypto — без jest/testing-library.
 * Запуск: вызвать runVaultCryptoTests() вручную из консоли или __DEV__ блока.
 *
 * Тесты используют libsodium напрямую, минуя Supabase и SecureStore,
 * поэтому работают в изолированном окружении.
 */

import {
  ready,
  crypto_box_keypair,
  crypto_box_easy,
  crypto_box_open_easy,
  crypto_box_NONCEBYTES,
  randombytes_buf,
} from 'react-native-libsodium';
import { isVaultEncrypted } from '../VaultCrypto';

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Шифрует/дешифрует напрямую через libsodium (без Supabase/SecureStore).
 */
function encryptDirect(
  plaintext: string,
  recipientPubKey: Uint8Array,
  senderSecretKey: Uint8Array
): string {
  const nonce = randombytes_buf(crypto_box_NONCEBYTES) as Uint8Array;
  const message = new TextEncoder().encode(plaintext);
  const ciphertext = crypto_box_easy(message, nonce, recipientPubKey, senderSecretKey) as Uint8Array;
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);
  return uint8ArrayToBase64(combined);
}

function decryptDirect(
  payload: string,
  senderPubKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string | null {
  try {
    const combined = base64ToUint8Array(payload);
    if (combined.length <= crypto_box_NONCEBYTES) return null;
    const nonce = combined.slice(0, crypto_box_NONCEBYTES);
    const ciphertext = combined.slice(crypto_box_NONCEBYTES);
    const decrypted = crypto_box_open_easy(ciphertext, nonce, senderPubKey, recipientSecretKey);
    if (!decrypted) return null;
    return new TextDecoder().decode(decrypted as Uint8Array);
  } catch {
    return null;
  }
}

export async function runVaultCryptoTests(): Promise<void> {
  await ready;

  const ORIGINAL = 'Привет, Vault!';
  let roundTripPayload = '';

  // ─── Тест 1: Encrypt → Decrypt round-trip ───────────────────────────────
  try {
    const sender = crypto_box_keypair();
    const recipient = crypto_box_keypair();

    roundTripPayload = encryptDirect(ORIGINAL, recipient.publicKey, sender.privateKey);
    const decrypted = decryptDirect(roundTripPayload, sender.publicKey, recipient.privateKey);

    if (decrypted !== ORIGINAL) {
      throw new Error(`Ожидалось «${ORIGINAL}», получено «${decrypted}»`);
    }
    console.log('[TEST 1] PASS: round-trip шифрование работает');
  } catch (error) {
    console.error('[TEST 1] FAIL:', error);
  }

  // ─── Тест 2: isVaultEncrypted ────────────────────────────────────────────
  try {
    const oldFormat = 'U2FsdGVkX1abc123';
    if (isVaultEncrypted(oldFormat) !== false) {
      throw new Error('U2FsdGVkX1... должен возвращать false');
    }
    if (roundTripPayload && isVaultEncrypted(roundTripPayload) !== true) {
      throw new Error('Валидный payload должен возвращать true');
    }
    console.log('[TEST 2] PASS: isVaultEncrypted корректно определяет формат');
  } catch (error) {
    console.error('[TEST 2] FAIL:', error);
  }

  // ─── Тест 3: Decrypt с неверным ключом ───────────────────────────────────
  try {
    if (!roundTripPayload) {
      throw new Error('Пропущен — payload из теста 1 пуст');
    }
    const wrongKeyPair = crypto_box_keypair();
    const senderForTest3 = crypto_box_keypair();
    const result = decryptDirect(roundTripPayload, senderForTest3.publicKey, wrongKeyPair.privateKey);
    if (result !== null) {
      throw new Error(`Ожидался null, получено: «${result}»`);
    }
    console.log('[TEST 3] PASS: неверный ключ возвращает null');
  } catch (error) {
    console.error('[TEST 3] FAIL:', error);
  }
}
