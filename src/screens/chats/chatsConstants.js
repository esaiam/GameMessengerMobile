import { ARIA_CONTACT, ARIA_ROOM_ID } from '../../lib/aria';

/** Интервал опроса списка комнат на вкладке «Чаты» (экран в фокусе и приложение active). */
export const CHATS_LIST_POLL_MS = 20000;

/** Строка Aria в списке чатов (не из `rooms`). */
export const ARIA_CHAT_LIST_ITEM = {
  isAria: true,
  roomId: ARIA_ROOM_ID,
  roomCode: null,
  contactName: ARIA_CONTACT.display_name,
  last: {
    id: 'aria-chats-preview',
    text: 'Привет. Я здесь.',
    message_type: 'text',
    created_at: null,
  },
};
