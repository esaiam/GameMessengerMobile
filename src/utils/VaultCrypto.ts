import {
  ready,
  crypto_box_easy,
  crypto_box_open_easy,
  crypto_box_NONCEBYTES,
  randombytes_buf,
} from 'react-native-libsodium';
import { getOrCreateKeyPair, KeyPair } from './VaultKeyStore';
import { fetchPublicKey } from './VaultKeyServer';

export type EncryptedPayload = string; // base64(nonce + ciphertext)

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
 * Шифрует текстовое сообщение для указанного получателя.
 * Использует асимметричное шифрование X25519-XSalsa20-Poly1305 (crypto_box).
 * Nonce генерируется случайно и препендируется к шифротексту.
 * Возвращает base64(nonce + ciphertext).
 *
 * Бросает Error если публичный ключ получателя не найден или шифрование не удалось.
 */
export async function encryptMessage(
  plaintext: string,
  recipientPlayerName: string
): Promise<EncryptedPayload> {
  if (!plaintext || plaintext.trim() === '') {
    throw new Error('Нельзя зашифровать пустое сообщение');
  }

  await ready;

  const myKeyPair: KeyPair = await getOrCreateKeyPair();
  const recipientPubKeyB64 = await fetchPublicKey(recipientPlayerName);

  if (!recipientPubKeyB64) {
    throw new Error(`VaultCrypto: публичный ключ получателя «${recipientPlayerName}» не найден`);
  }

  const recipientPubKey = base64ToUint8Array(recipientPubKeyB64);
  const nonce = randombytes_buf(crypto_box_NONCEBYTES) as Uint8Array;
  const message = new TextEncoder().encode(plaintext);

  const ciphertext = crypto_box_easy(message, nonce, recipientPubKey, myKeyPair.secretKey) as Uint8Array;

  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  if (combined.length === 0) {
    throw new Error('VaultCrypto: шифрование вернуло пустой результат');
  }

  return uint8ArrayToBase64(combined);
}

/**
 * Расшифровывает зашифрованный payload от указанного отправителя.
 * Извлекает nonce из первых crypto_box_NONCEBYTES байт, затем расшифровывает остаток.
 * Возвращает null при любой ошибке (неверный ключ, повреждённые данные, отсутствие ключа).
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  senderPlayerName: string
): Promise<string | null> {
  try {
    // nonce (24 bytes) + MAC (16 bytes) = 40 bytes → ~54 base64 chars minimum
    if (!payload || payload.length < 54) return null;

    await ready;

    const myKeyPair: KeyPair = await getOrCreateKeyPair();
    const senderPubKeyB64 = await fetchPublicKey(senderPlayerName);

    if (!senderPubKeyB64) return null;

    const senderPubKey = base64ToUint8Array(senderPubKeyB64);
    const combined = base64ToUint8Array(payload);

    if (combined.length <= crypto_box_NONCEBYTES) return null;

    const nonce = combined.slice(0, crypto_box_NONCEBYTES);
    const ciphertext = combined.slice(crypto_box_NONCEBYTES);

    const decrypted = crypto_box_open_easy(ciphertext, nonce, senderPubKey, myKeyPair.secretKey);

    if (!decrypted) return null;

    return new TextDecoder().decode(decrypted as Uint8Array);
  } catch {
    return null;
  }
}

/**
 * Проверяет, является ли строка зашифрованным Vault-сообщением.
 * Признаки: длина > 60, валидный base64, не является старым CryptoJS-форматом.
 */
export function isVaultEncrypted(text: string): boolean {
  if (text.length <= 60) return false;
  if (text.startsWith('U2FsdGVkX1')) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(text);
}

export default { encryptMessage, decryptMessage, isVaultEncrypted };
