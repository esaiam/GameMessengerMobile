import { supabase } from './supabase';
import { hideChatRoom } from './hiddenChats';
import { vaultHideRoomForEveryone } from './vaultHideRoomForEveryone';
import { broadcastThreadClear } from './chatThreadBroadcast';
import { clearRoomReadCursor } from './chatReadCursor';
import roomMessagesCache from '../utils/roomMessagesCache';

const PAGE_SIZE = 150;
const UPDATE_CHUNK = 25;

async function fetchAllRoomMessages(roomId) {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, hidden_for, player_name')
      .eq('room_id', roomId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/** Скрыть все сообщения комнаты при удалении чата из списка (только у меня или у всех). */
export async function hideRoomMessagesForDelete({
  roomId,
  nickname,
  peerName,
  deleteForEveryone,
}) {
  if (deleteForEveryone) {
    await vaultHideRoomForEveryone(roomId);
    await clearRoomReadCursor(nickname, roomId);
    roomMessagesCache.set(roomId, []);
    void broadcastThreadClear(roomId);
    return;
  }

  const messages = await fetchAllRoomMessages(roomId);
  roomMessagesCache.set(roomId, []);

  if (messages.length === 0) return;

  for (let i = 0; i < messages.length; i += UPDATE_CHUNK) {
    const chunk = messages.slice(i, i + UPDATE_CHUNK);
    const results = await Promise.all(
      chunk.map((msg) => {
        if ((msg.hidden_for || []).includes(nickname)) {
          return { error: null };
        }
        const nextHidden = [...new Set([...(msg.hidden_for || []), nickname])];
        return supabase.from('messages').update({ hidden_for: nextHidden }).eq('id', msg.id);
      }),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }
}

/**
 * Удаление выбранных чатов: скрыть из списка + обновить hidden_for у всех сообщений комнаты.
 * @param {{ nickname: string, roomIds: string[], peerByRoomId: Map<string, string | null>, deleteForEveryone: boolean }} opts
 */
export async function deleteChatsFromList({
  nickname,
  roomIds,
  peerByRoomId,
  deleteForEveryone,
}) {
  for (const roomId of roomIds) {
    await hideRoomMessagesForDelete({
      roomId,
      nickname,
      peerName: peerByRoomId.get(roomId) ?? null,
      deleteForEveryone,
    });
    await hideChatRoom(nickname, roomId);
  }
}
