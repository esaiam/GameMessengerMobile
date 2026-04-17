import CryptoJS from 'crypto-js';

const SALT = 'backgammon-e2e-v1';

/**
 * Derives a passphrase from room code + salt.
 * Using string passphrase mode — CryptoJS internally handles
 * key derivation (EvpKDF) and random IV per encryption call.
 */
export function deriveKey(roomCode) {
  return roomCode + ':' + SALT;
}

export function encrypt(plaintext, passphrase) {
  try {
    return CryptoJS.AES.encrypt(plaintext, passphrase).toString();
  } catch {
    return plaintext;
  }
}

export function decrypt(ciphertext, passphrase) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || null;
  } catch {
    return null;
  }
}

/** Типичный вывод CryptoJS.AES (base64, префикс Salted__) */
export function looksLikeEncryptedPayload(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  return t.startsWith('U2FsdGVkX1') || (t.length > 40 && /^[A-Za-z0-9+/=\s]+$/.test(t));
}
