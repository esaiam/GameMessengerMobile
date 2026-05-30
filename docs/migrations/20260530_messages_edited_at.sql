-- Шаг 7: редактирование текстовых сообщений (DM).
-- Применить на prod вручную (Supabase SQL Editor / migrate).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN public.messages.edited_at IS
  'Время последнего редактирования текста; NULL — не редактировалось.';

-- PostgREST: обновить schema cache (иначе PGRST «Could not find edited_at in schema cache»).
NOTIFY pgrst, 'reload schema';

-- RLS: автор может обновлять text + edited_at своих строк.
-- Если политика messages_update_own уже есть с WITH CHECK (player_name) — достаточно.
-- Пример (сверить с prod, не дублировать имя):
--
-- CREATE POLICY messages_update_own_text ON public.messages
--   FOR UPDATE
--   USING (player_name = auth.jwt() ->> 'user_metadata' ->> 'nickname' /* или ваша схема */)
--   WITH CHECK (player_name = ...);
