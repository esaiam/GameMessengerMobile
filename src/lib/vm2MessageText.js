import { decryptMessage } from '../utils/VaultCrypto';

/** @param {string | null | undefined} text */
export function isVm2Payload(text) {
  return typeof text === 'string' && text.startsWith('VM2:');
}

/**
 * @param {string} raw
 * @param {{ player_name?: string }} msg
 * @param {string} nickname
 * @returns {Promise<string | null>}
 */
export async function decryptVm2MessageText(raw, msg, nickname) {
  if (!isVm2Payload(raw) || !nickname) return null;
  try {
    const { r, s } = JSON.parse(raw.slice(4));
    const isMyMessage = msg.player_name === nickname;
    const box = isMyMessage ? s : r;
    const senderName = isMyMessage ? nickname : msg.player_name;
    if (!box || !senderName) return null;
    return await decryptMessage(box, senderName);
  } catch {
    return null;
  }
}
