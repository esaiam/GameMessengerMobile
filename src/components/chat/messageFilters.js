/** @param {import('./chatMessageTypes').ChatMessageRow[]} msgs */
export function filterExpiredMessages(msgs) {
  const now = Date.now();
  return msgs.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
}

/** @param {import('./chatMessageTypes').ChatMessageRow[]} msgs */
export function filterHiddenForUser(msgs, nickname) {
  return msgs.filter((m) => !(m.hidden_for || []).includes(nickname));
}

/**
 * @param {import('./chatMessageTypes').ChatMessageRow[]} msgs
 * @param {string} nickname
 * @param {(id: string) => boolean} isDeletingId — сообщение видно, если для меня скрыто, но идёт локальная анимация удаления
 */
export function filterHiddenForUserKeepingDeleting(msgs, nickname, isDeletingId) {
  return msgs.filter((m) => {
    const hidden = (m.hidden_for || []).includes(nickname);
    if (!hidden) return true;
    return isDeletingId(m.id);
  });
}
