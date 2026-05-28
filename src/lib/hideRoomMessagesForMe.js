import { supabase } from './supabase';
import roomMessagesCache from '../utils/roomMessagesCache';

/**
 * Скрыть все сообщения комнаты только для текущего пользователя (hidden_for).
 * @param {{ roomId: string, nickname: string }} params
 */
export async function hideAllRoomMessagesForMe({ roomId, nickname }) {
  if (!roomId || !nickname) return { count: 0 };

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('id, hidden_for')
    .eq('room_id', roomId);

  if (error) throw error;
  const list = msgs || [];
  if (list.length === 0) {
    roomMessagesCache.set(roomId, []);
    return { count: 0 };
  }

  const results = await Promise.all(
    list.map((msg) => {
      const nextHidden = [...new Set([...(msg.hidden_for || []), nickname])];
      return supabase.from('messages').update({ hidden_for: nextHidden }).eq('id', msg.id);
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  roomMessagesCache.set(roomId, []);
  return { count: list.length };
}

/**
 * Скрыть выбранные сообщения только для текущего пользователя (hidden_for).
 * @param {{ messageIds: string[], nickname: string, roomId?: string }} params
 */
export async function hideMessagesForMe({ messageIds, nickname, roomId }) {
  if (!nickname || !messageIds?.length) return { count: 0 };

  const unique = [...new Set(messageIds)];
  const updates = new Map();

  const results = await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await supabase
        .from('messages')
        .select('hidden_for')
        .eq('id', id)
        .maybeSingle();
      if (error) return { error };
      const nextHidden = [...new Set([...(data?.hidden_for || []), nickname])];
      const res = await supabase.from('messages').update({ hidden_for: nextHidden }).eq('id', id);
      if (!res.error) updates.set(id, nextHidden);
      return res;
    }),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  if (roomId) {
    const cached = roomMessagesCache.get(roomId);
    if (cached?.length) {
      const idSet = new Set(unique);
      roomMessagesCache.set(
        roomId,
        cached
          .map((m) =>
            idSet.has(m.id) ? { ...m, hidden_for: updates.get(m.id) ?? m.hidden_for } : m,
          )
          .filter((m) => !(m.hidden_for || []).includes(nickname)),
      );
    }
  }

  return { count: updates.size };
}
