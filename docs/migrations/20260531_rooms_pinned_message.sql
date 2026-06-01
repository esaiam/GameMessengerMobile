-- Закреплённое сообщение в DM (одно на комнату).
-- Применить на prod вручную (Supabase SQL Editor / migrate).

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rooms.pinned_message_id IS
  'ID закреплённого сообщения в комнате; NULL — ничего не закреплено.';

CREATE INDEX IF NOT EXISTS rooms_pinned_message_id_idx
  ON public.rooms (pinned_message_id)
  WHERE pinned_message_id IS NOT NULL;

-- PostgREST: обновить schema cache.
NOTIFY pgrst, 'reload schema';

-- RLS: участники комнаты могут менять pinned_message_id.
-- Сверить с prod — не дублировать имя политики, если уже есть UPDATE для участников:
--
-- CREATE POLICY rooms_update_pinned_message ON public.rooms
--   FOR UPDATE
--   USING (
--     user1_id = (auth.jwt() -> 'user_metadata' ->> 'nickname')
--     OR user2_id = (auth.jwt() -> 'user_metadata' ->> 'nickname')
--   )
--   WITH CHECK (
--     user1_id = (auth.jwt() -> 'user_metadata' ->> 'nickname')
--     OR user2_id = (auth.jwt() -> 'user_metadata' ->> 'nickname')
--   );
