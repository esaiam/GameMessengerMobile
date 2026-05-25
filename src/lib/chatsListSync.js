import { unhideChatRoom } from './hiddenChats';
import { loadDialogsCache, saveDialogsCache } from '../utils/dialogsCache';

/** Вызывается из useChatsRoomsLoader при монтировании ChatsScreen. */
export const chatsListSyncApi = {
  reload: null,
};

export function registerChatsListReload(fn) {
  chatsListSyncApi.reload = fn ?? null;
}

export function requestChatsListReload() {
  chatsListSyncApi.reload?.();
}

/**
 * Показать DM в списке чатов (даже если вкладка «Чаты» не смонтирована).
 * @param {string} nickname
 * @param {{ roomId: string, roomCode?: string, contactName: string, last?: object | null }} row
 */
export async function syncDialogToChatsList(nickname, row) {
  if (!nickname || !row?.roomId || !row?.contactName) return;

  await unhideChatRoom(nickname, row.roomId);

  try {
    const cached = (await loadDialogsCache(nickname)) || [];
    const without = cached.filter((r) => r.roomId !== row.roomId);
    const next = [{ ...row, last: row.last ?? null }, ...without];
    await saveDialogsCache(nickname, next);
  } catch {
    // кэш не критичен
  }

  requestChatsListReload();
}

/** После отправки сообщения — снять скрытие и перезагрузить список с сервера. */
export async function refreshChatsListAfterMessage(nickname, roomId) {
  if (!nickname || !roomId) return;
  await unhideChatRoom(nickname, roomId);
  requestChatsListReload();
}
