import { ready, crypto_generichash } from 'react-native-libsodium';

/** @param {string} input */
export async function sha256Hex(input) {
  await ready;
  const bytes = new TextEncoder().encode(String(input));
  const hash = crypto_generichash(32, bytes);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
