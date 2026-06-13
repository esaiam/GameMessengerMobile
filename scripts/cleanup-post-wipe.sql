-- Post-wipe cleanup: DB rows without message history.
-- Safe when messages=0 (orphan metadata only).
-- Apply: SQL Editor OR npx supabase db query --linked --file ...

BEGIN;

-- Скрытые чаты (пустые комнаты снова появятся в списке)
DELETE FROM public.hidden_chat_rooms;

-- Старые игровые сессии без привязки к ленте
DELETE FROM public.game_sessions;

-- Превью уже NULL после wipe; на всякий случай:
UPDATE public.rooms
SET last_message_at = NULL,
    last_message_id = NULL,
    thread_cleared_at = NULL
WHERE last_message_at IS NOT NULL
   OR last_message_id IS NOT NULL
   OR thread_cleared_at IS NOT NULL;

COMMIT;

SELECT 'hidden_chat_rooms' AS what, count(*)::bigint AS n FROM public.hidden_chat_rooms
UNION ALL SELECT 'game_sessions', count(*) FROM public.game_sessions
UNION ALL SELECT 'messages', count(*) FROM public.messages
UNION ALL SELECT 'rooms', count(*) FROM public.rooms;
