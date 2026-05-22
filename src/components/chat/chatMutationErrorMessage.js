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
  if (code === 'PGRST301' || /jwt expired|invalid jwt|not authenticated/i.test(msg)) {
    return 'Сессия истекла. Выйди из приложения и войди снова.';
  }
  if (/Failed to fetch|Network request failed|timeout/i.test(msg)) {
    return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.';
  }

  return msg || fallback;
}
