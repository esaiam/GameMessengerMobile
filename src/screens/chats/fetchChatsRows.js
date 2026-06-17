import { supabase } from '../../lib/supabase';

/**
 * Загружает комнаты пользователя, отсортированные по времени последнего сообщения.
 * Требует миграции: supabase/migrations/20260521_rooms_last_message.sql
 *
 * Два запроса:
 *  1. rooms — список с last_message_at / last_message_id (денормализованные поля)
 *  2. messages — батч последних сообщений по их ID (1 запрос вместо N)
 */
export async function fetchChatsRows(nickname) {
  if (!nickname) return { rows: [], error: false };

  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('id, code, user1_id, user2_id, last_message_at, last_message_id, thread_cleared_at')
    .or(`user1_id.eq.${nickname},user2_id.eq.${nickname}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (roomsError) {
    return { rows: null, error: true };
  }

  const roomList = rooms || [];

  // Собрать IDs последних сообщений и загрузить их одним запросом
  const lastMsgIds = roomList.map((r) => r.last_message_id).filter(Boolean);
  let lastMsgById = {};

  if (lastMsgIds.length > 0) {
    const { data: lastMsgs, error: msgsError } = await supabase
      .from('messages')
      .select('id, room_id, text, message_type, created_at, player_name, read_at, hidden_for')
      .in('id', lastMsgIds);

    if (msgsError) {
      return { rows: null, error: true };
    }

    (lastMsgs || []).forEach((m) => {
      lastMsgById[m.id] = m;
    });
  }

  const next = roomList.map((r) => {
    const other = r.user1_id === nickname ? r.user2_id || '...' : r.user1_id || '...';
    const last = r.last_message_id ? (lastMsgById[r.last_message_id] || null) : null;
    return {
      roomId: r.id,
      roomCode: r.code,
      contactName: other,
      last };
  });

  return { rows: next, error: false };
}
