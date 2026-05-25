import { ARIA_CONTACT, ARIA_ROOM_ID } from '../../lib/aria';

/**
 * Интервал фонового опроса списка комнат.
 * Realtime (postgres_changes на rooms.last_message_id) покрывает превью мгновенно.
 * Polling нужен только как fallback (reconnect, gap sync).
 */
export const CHATS_LIST_POLL_MS = 60000;

/** Превью строки Aria в списке чатов. */
export const ARIA_CHATS_PREVIEW_TEXT = 'Привет. Я здесь.';

/** Строка Aria в списке чатов (не из `rooms`). */
export const ARIA_CHAT_LIST_ITEM = {
  isAria: true,
  roomId: ARIA_ROOM_ID,
  roomCode: null,
  contactName: ARIA_CONTACT.display_name,
  last: {
    id: 'aria-chats-preview',
    text: ARIA_CHATS_PREVIEW_TEXT,
    message_type: 'text',
    created_at: null } };
