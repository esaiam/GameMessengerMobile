/**
 * @param {Record<string, unknown> | null | undefined} room
 * @param {string} nickname
 * @param {boolean} selfPlay
 * @param {string | null} routePeerName
 */
export function resolveGameOpponentName(room, nickname, selfPlay, routePeerName) {
  if (selfPlay) return nickname;
  if (!room || !nickname) return routePeerName;
  const u1 = room?.user1_id || null;
  const u2 = room?.user2_id || null;
  if (!u1 && !u2) return routePeerName;
  if (u1 === nickname) return u2;
  if (u2 === nickname) return u1;
  return routePeerName || u2 || u1;
}
