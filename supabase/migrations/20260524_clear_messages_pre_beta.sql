-- Pre-beta: no production users — wipe message history and room list previews.
-- Safe to run once on dev/staging/prod before VM2-only client.

DELETE FROM messages;

UPDATE rooms
SET last_message_at = NULL,
    last_message_id = NULL;
