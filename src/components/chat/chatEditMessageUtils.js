/**
 * Можно ли редактировать сообщение в DM (шаг 7 MVP).
 * @param {object | null | undefined} msg
 * @param {string} nickname
 * @param {boolean} [isAriaChat]
 */
export function canEditMessage(msg, nickname, isAriaChat = false) {
  if (isAriaChat || !msg || !nickname) return false;
  if (msg.player_name !== nickname) return false;
  if (msg._isOptimistic === true) return false;
  if (msg.aria_voice_message === true) return false;
  if (msg.message_type && msg.message_type !== 'text') return false;
  const id = msg.id;
  if (id == null) return false;
  const sid = String(id);
  if (sid.startsWith('__opt_')) return false;
  return true;
}
