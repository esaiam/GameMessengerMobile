-- Pre-beta wipe — ONE-TIME, already applied on prod before closed beta.
-- DO NOT re-run: DELETE FROM messages wipes all chat history.
--
-- Original (2026-05-24):
--   DELETE FROM messages;
--   UPDATE rooms SET last_message_at = NULL, last_message_id = NULL;
--
-- Re-applying via apply-supabase-migrations.ps1 caused message loss on 2026-06-13.
-- This file is intentionally a no-op; history must not be deleted again.

SELECT 1 AS clear_messages_pre_beta_noop;
