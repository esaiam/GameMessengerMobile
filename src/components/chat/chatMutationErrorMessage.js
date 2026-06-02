/**
 * Тексты для Alert при ошибках UPDATE/DELETE messages (prod RLS, не dev-скрипты).
 * @param {import('@supabase/supabase-js').PostgrestError | { message?: string; code?: string } | null | undefined} error
 * @param {string} fallback
 */
export function chatMutationErrorMessage(error, fallback) {
  const msg = String(error?.message || '').trim();
  const code = error?.code;

  if (code === '42501' || /permission denied|row-level security|violates row-level/i.test(msg)) {
    return 'Нет прав изменить сообщение. Убедись, что ты вошёл в аккаунт и это твой чат.';
  }
  if (/blocked_peer/i.test(msg)) {
    return 'Сообщение не отправлено: контакт заблокирован.';
  }
  if (code === 'PGRST301' || /jwt expired|invalid jwt|not authenticated/i.test(msg)) {
    return 'Сессия истекла. Выйди из приложения и войди снова.';
  }
  if (/Failed to fetch|Network request failed|timeout/i.test(msg)) {
    return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
  }
  if (
    (code === 'PGRST204' && /pinned_message_id/i.test(msg)) ||
    /Could not find the ['"]pinned_message_id['"] column/i.test(msg) ||
    /column rooms\.pinned_message_id does not exist/i.test(msg)
  ) {
    return 'На сервере нет колонки pinned_message_id. В Supabase SQL Editor выполни миграцию docs/migrations/20260531_rooms_pinned_message.sql и NOTIFY pgrst, \'reload schema\';';
  }
  if (
    code === '23503' ||
    /rooms_pinned_message_id_fkey|foreign key constraint.*pinned_message_id/i.test(msg)
  ) {
    return 'Не удалось закрепить: сообщение не найдено на сервере. Дождись отправки или выбери другое сообщение.';
  }
  if (
    (code === 'PGRST204' && /edited_at/i.test(msg)) ||
    /Could not find the ['"]edited_at['"] column/i.test(msg) ||
    /column messages\.edited_at does not exist/i.test(msg)
  ) {
    return 'На сервере нет колонки edited_at. В Supabase SQL Editor выполни миграцию docs/migrations/20260530_messages_edited_at.sql и NOTIFY pgrst, \'reload schema\';';
  }

  return msg || fallback;
}
