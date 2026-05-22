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
