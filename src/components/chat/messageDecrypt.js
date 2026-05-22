import { decryptVm2MessageText, isVm2Payload } from '../../lib/vm2MessageText';

/** Кэш расшифрованных сообщений — персистится между ремонтированиями чата */
const decryptedCache = new Map();

/**
 * @param {{ nickname: string }} ctx
 * @returns {(msg: import('./chatMessageTypes').ChatMessageRow) => Promise<import('./chatMessageTypes').ChatMessageRow>}
 */
export function createDecryptMsg({ nickname }) {
  return async function decryptMsg(msg) {
    const raw = msg.text;
    if (!raw) return msg;

    if (isVm2Payload(raw)) {
      const plain = await decryptVm2MessageText(raw, msg, nickname);
      if (plain !== null) return { ...msg, text: plain };
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
          if (!isVm2Payload(cached)) {
            return { ...m, text: cached };
          }
          decryptedCache.delete(m.id);
        }
        const row = await decryptMsg(m);
        if (row.text !== m.text && !isVm2Payload(row.text)) {
          decryptedCache.set(m.id, row.text);
        }
        return row;
      }),
    );
    result.push(...decrypted);
  }
  return result;
}
