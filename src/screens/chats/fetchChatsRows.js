import { supabase } from '../../lib/supabase';
import roomMessagesCache from '../../utils/roomMessagesCache';

/**
 * Загружает комнаты пользователя и последнее сообщение по каждой.
 * @returns {{ rows: Array | null, error: boolean }} rows === null при ошибке запроса
 */
export async function fetchChatsRows(nickname) {
  if (!nickname) return { rows: [], error: false };

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, code, user1_id, user2_id')
    .or(`user1_id.eq.${nickname},user2_id.eq.${nickname}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (roomsError) {
    return { rows: null, error: true };
  }

  const roomList = rooms || [];
  const roomIds = roomList.map((r) => r.id);

  let lastByRoom = {};
  if (roomIds.length > 0) {
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, room_id, text, message_type, created_at, player_name')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(200);

    if (messagesError) {
      return { rows: null, error: true };
    }

    (messages || []).forEach((m) => {
      if (!lastByRoom[m.room_id]) lastByRoom[m.room_id] = m;
    });
  }

  const next = roomList.map((r) => {
    const other =
      r.user1_id === nickname ? r.user2_id || '...' : r.user1_id || '...';
    const last = lastByRoom[r.id] || null;
    return {
      roomId: r.id,
      roomCode: r.code,
      contactName: other,
      last,
    };
  });

  next.forEach(({ roomId, last }) => {
    if (!last) return;
    if (roomMessagesCache.has(roomId)) return;
    roomMessagesCache.set(roomId, [last]);
  });

  return { rows: next, error: false };
}
