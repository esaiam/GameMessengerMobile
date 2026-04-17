-- При включённом RLS без этих политик UPDATE/DELETE к messages запрещены — «удалить у меня / у всех» не работают.
-- Выполни в Supabase → SQL Editor.

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can update messages" ON messages;
CREATE POLICY "Anyone can update messages"
  ON messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete messages" ON messages;
CREATE POLICY "Anyone can delete messages"
  ON messages FOR DELETE
  USING (true);
