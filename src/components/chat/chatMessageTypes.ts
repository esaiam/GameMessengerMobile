/**
 * Типы строки сообщения в чате (Supabase `messages` + клиентские поля).
 *
 * В `.js` для подсказок IDE: `import('./chatMessageTypes').ChatMessageRow`
 * или JSDoc: `@param {import('./chatMessageTypes').ChatMessageRow} msg`
 */

/** Значения `message_type` в приложении (в БД может быть null → трактуем как текст). */
export type ChatMessageType =
  | 'text'
  | 'image'
  | 'voice'
  | 'audio'
  | 'video'
  | 'location';

/**
 * Реакции: emoji → список `player_name`, поставивших реакцию.
 * Формат согласован с `toggleReaction` / колонкой JSON в БД.
 */
export type ChatMessageReactions = Record<string, string[]>;

/**
 * Сырой ряд из БД после `.select(...)` + расшифровки `text` (содержимое то же поле).
 * Плюс клиентские расширения (оптимистичное видео, стабильный ключ строки).
 */
export interface ChatMessageRow {
  id: string;
  room_id: string;
  player_name: string;
  text?: string | null;
  created_at: string;
  read_at?: string | null;
  reply_to?: string | null;
  reactions?: ChatMessageReactions | null;
  hidden_for?: string[] | null;
  message_type?: ChatMessageType | string | null;
  media_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  expires_at?: string | null;
  waveform?: number[] | null;
  /** Стабильный ключ для inverted list при замене optimistic id на серверный. */
  clientRowKey?: string;
  /** Локальный плейсхолдер до подтверждения upload. */
  _isOptimistic?: boolean;
}

/**
 * Элемент `formattedMessages` для `FlatList`: базовая строка + поля из `buildFormattedMessagesCached`.
 */
export interface ChatFormattedMessageRow extends ChatMessageRow {
  _formattedTime: string;
  _dateLabel: string;
  _dateKey: string;
  _showDate: boolean;
  _sameDay: boolean;
  _abovePlayerName: string | null;
}
