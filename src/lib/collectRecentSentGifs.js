import { isGifMediaUrl } from './isGifMediaUrl';

const DEFAULT_LIMIT = 48;

/**
 * GIF, которые пользователь уже отправлял в этой комнате (для панели эмодзи).
 * @param {Array<{ message_type?: string, media_url?: string, player_name?: string, id?: string, created_at?: string }>} messages
 * @param {{ senderName?: string, limit?: number }} [opts]
 */
export function collectRecentSentGifs(messages, { senderName, limit = DEFAULT_LIMIT } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const sender = typeof senderName === 'string' ? senderName.trim() : '';
  const seen = new Set();
  const out = [];

  for (let i = messages.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const m = messages[i];
    if (m?.message_type !== 'image') continue;
    const url = m.media_url;
    if (!isGifMediaUrl(url)) continue;
    if (sender && m.player_name !== sender) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      id: `sent-${m.id ?? url}`,
      fullUrl: url,
      thumbUrl: url,
      reuseUrl: true });
  }

  return out;
}
