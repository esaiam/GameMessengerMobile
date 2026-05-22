/**
 * Список значений для hidden_for при «удалить у всех».
 * Prod rooms: только user1_id / user2_id (handle); player_name из снимка сообщений — на случай legacy.
 *
 * @param {Record<string, unknown> | null | undefined} room
 * @param {string} nickname
 * @param {{ peerName?: string | null; messagesSnapshot?: Array<{ player_name?: string }> }} [opts]
 */
export function buildHiddenForEveryone(room, nickname, opts = {}) {
  const { peerName = null, messagesSnapshot = [] } = opts;
  const set = new Set();
  const add = (v) => {
    if (v == null) return;
    const raw = typeof v === 'string' ? v.trim() : String(v).trim();
    if (raw) set.add(raw);
  };

  if (room && typeof room === 'object') {
    add(room.user1_id);
    add(room.user2_id);
  }

  add(nickname);
  add(peerName);

  if (Array.isArray(messagesSnapshot)) {
    for (const m of messagesSnapshot) {
      if (m?.player_name != null) add(m.player_name);
    }
  }

  const arr = [...set];
  return arr.length > 0 ? arr : [nickname];
}
