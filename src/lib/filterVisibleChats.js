import { getBlockedPeers, normalizePeerHandle } from './blockedContacts';
import { getHiddenChatRoomIds } from './hiddenChats';

/** Убирает заблокированных и «удалённые у меня» диалоги из списка чатов. */
export async function filterVisibleChatRows(nickname, rows, options = {}) {
  const { forceRefreshHidden = false } = options;
  if (!nickname || !rows?.length) return rows || [];
  const [blocked, hiddenRooms] = await Promise.all([
    getBlockedPeers(nickname),
    getHiddenChatRoomIds(nickname, { forceRefresh: forceRefreshHidden }),
  ]);
  return rows.filter((r) => {
    if (r.isAria) return true;
    if (blocked.has(normalizePeerHandle(r.contactName))) return false;
    if (r.last && (r.last.hidden_for || []).includes(nickname)) return false;
    if (r.roomId && hiddenRooms.has(r.roomId)) {
      // После «удалить у всех» + новое сообщение: last видим — показать чат
      if (r.last && !(r.last.hidden_for || []).includes(nickname)) return true;
      return false;
    }
    return true;
  });
}
