/** Размер страницы истории (initial + pagination). */
export const MESSAGES_PAGE_SIZE = 30;

export const MESSAGE_LIST_SELECT =
  'id, room_id, player_name, text, created_at, read_at, edited_at, reply_to, reactions, hidden_for, message_type, media_url, latitude, longitude, expires_at, waveform';

/**
 * Объединить списки сообщений по id, сортировка: старые → новые.
 * При конфликте id побеждает **последний** список в аргументах.
 * @param {...import('./chatMessageTypes').ChatMessageRow[]} lists
 */
/** id сообщений, скрытых для nickname на сервере (сырые строки до decrypt). */
export function serverHiddenForMeIdSet(nickname, rows) {
  const hidden = new Set();
  for (const m of rows ?? []) {
    if (m?.id != null && (m.hidden_for || []).includes(nickname)) {
      hidden.add(m.id);
    }
  }
  return hidden;
}

export function mergeMessagesById(...lists) {
  const byId = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (m?.id != null) byId.set(m.id, m);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}
