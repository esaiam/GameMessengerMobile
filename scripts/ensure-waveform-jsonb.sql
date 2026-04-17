-- Колонка для массива высот волны (40 чисел). Выполни в Supabase → SQL Editor.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS waveform jsonb;

-- После добавления колонки PostgREST иногда кэширует старую схему — без этого INSERT может «молча» не писать новое поле.
NOTIFY pgrst, 'reload schema';
