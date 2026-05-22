import { decrypt, looksLikeEncryptedPayload } from '../../utils/crypto';
import { getKeyFromCache } from '../../utils/VaultKeyServer';
import { decryptMessage, isVaultEncrypted } from '../../utils/VaultCrypto';

/** Кэш расшифрованных сообщений — персистится между ремонтированиями чата */
const decryptedCache = new Map();

/**
 * @param {{ nickname: string, cryptoKey: string | null }} ctx
 * @returns {(msg: import('./chatMessageTypes').ChatMessageRow) => Promise<import('./chatMessageTypes').ChatMessageRow>}
 */
export function createDecryptMsg({ nickname, cryptoKey }) {
  return async function decryptMsg(msg) {
    const raw = msg.text;
    if (!raw) return msg;

    if (raw.startsWith('VM2:')) {
      try {
        const { r, s } = JSON.parse(raw.slice(4));
        const isMyMessage = msg.player_name === nickname;
        const box = isMyMessage ? s : r;
        const senderName = isMyMessage ? nickname : msg.player_name;
        const plain = await decryptMessage(box, senderName);
        if (plain !== null) return { ...msg, text: plain };
      } catch (e) {
        if (__DEV__) console.warn('[Vault] VM2 parse error:', e?.message);
      }
    }

    if (isVaultEncrypted(raw)) {
      try {
        const isMyMessage = msg.player_name === nickname;
        if (!isMyMessage) {
          const peerName = msg.player_name;
          const cachedKey = getKeyFromCache(peerName);
          if (peerName && cachedKey) {
            const plain = await decryptMessage(raw, peerName);
            if (plain !== null) {
              const looksValid = /^[\x20-\x7E\u0400-\u04FF\s]+$/.test(plain);
              if (looksValid) return { ...msg, text: plain };
            }
          }
        }
      } catch {}
    }

    if (looksLikeEncryptedPayload(raw) && cryptoKey) {
      const plain = decrypt(raw, cryptoKey);
      if (plain) return { ...msg, text: plain };
    }

    if (isVaultEncrypted(raw)) {
      return { ...msg, text: '🔒 Сообщение зашифровано' };
    }
    return msg;
  };
}

/**
 * @param {import('./chatMessageTypes').ChatMessageRow[]} msgs
 * @param {(msg: import('./chatMessageTypes').ChatMessageRow) => Promise<import('./chatMessageTypes').ChatMessageRow>} decryptMsg
 */
export async function decryptMessagesBatch(msgs, decryptMsg) {
  const CHUNK = 10;
  const result = [];
  for (let i = 0; i < msgs.length; i += CHUNK) {
    const chunk = msgs.slice(i, i + CHUNK);
    const decrypted = await Promise.all(
      chunk.map(async (m) => {
        if (decryptedCache.has(m.id)) {
          const cached = decryptedCache.get(m.id);
          if (!isVaultEncrypted(cached) && !looksLikeEncryptedPayload(cached)) {
            return { ...m, text: cached };
          }
          decryptedCache.delete(m.id);
        }
        const row = await decryptMsg(m);
        if (row.text !== m.text && !isVaultEncrypted(row.text)) {
          decryptedCache.set(m.id, row.text);
        }
        return row;
      }),
    );
    result.push(...decrypted);
  }
  return result;
}
