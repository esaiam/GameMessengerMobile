-- ============================================================
-- Дедуп push по message_id (используется Edge send_push_on_message).
-- Идемпотентно.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_dedup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_dedup_created_at
  ON public.push_dedup (created_at);

ALTER TABLE public.push_dedup ENABLE ROW LEVEL SECURITY;

-- Клиентам не нужен доступ; Edge Function ходит с service_role.
DROP POLICY IF EXISTS push_dedup_no_client ON public.push_dedup;
CREATE POLICY push_dedup_no_client ON public.push_dedup
  FOR ALL
  USING (false)
  WITH CHECK (false);
