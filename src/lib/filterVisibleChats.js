import { getBlockedPeers } from './blockedContacts';
import { getHiddenChatRoomIds } from './hiddenChats';

/** Убирает заблокированных и «удалённые у меня» диалоги из списка чатов. */
export async function filterVisibleChatRows(nickname, rows) {
  if (!nickname || !rows?.length) return rows || [];
  const [blocked, hiddenRooms] = await Promise.all([
    getBlockedPeers(nickname),
    getHiddenChatRoomIds(nickname)]);
  return rows.filter((r) => {
    if (r.isAria) return true;
    if (blocked.has(r.contactName)) return false;
    if (r.roomId && hiddenRooms.has(r.roomId)) return false;
    return true;
  });
}
