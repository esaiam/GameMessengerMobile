-- 2026-03-30: Modern messenger pattern
-- - One permanent room per user pair (deterministic id)
-- - game_sessions as sub-entity per room
--
-- IMPORTANT:
-- - This script is written to be run manually in Supabase SQL editor.
-- - Review on a staging DB first.

BEGIN;

-- 1) New rooms table (deterministic id + ordered pair)
CREATE TABLE IF NOT EXISTS rooms_v2 (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  user1_id text NOT NULL,
  user2_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT rooms_user_order CHECK (user1_id < user2_id),
  CONSTRAINT rooms_unique_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_v2_created_at ON rooms_v2(created_at DESC);

-- 2) New messages table (room_id becomes text)
CREATE TABLE IF NOT EXISTS messages_v2 (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text REFERENCES rooms_v2(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  -- messenger extras
  read_at timestamptz,
  reply_to uuid REFERENCES messages_v2(id),
  reactions jsonb DEFAULT '{}'::jsonb,
  -- media extras
  message_type text DEFAULT 'text',
  media_url text,
  latitude double precision,
  longitude double precision,
  -- ephemeral
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_messages_v2_room_id ON messages_v2(room_id);

-- 3) game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id text NOT NULL REFERENCES rooms_v2(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  winner_id text,
  board_state jsonb
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room_id ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);

-- Enforce one active session per room
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_sessions_one_active_per_room
  ON game_sessions(room_id)
  WHERE status = 'active';

-- 4) Pick "keeper room" for each pair: the one with most messages
-- Canonical pair key = sorted player names; deterministic room id = room_<u1>_<u2>
WITH room_pairs AS (
  SELECT
    r.id AS old_room_id,
    r.code AS old_code,
    r.created_at AS old_created_at,
    r.player1_name,
    r.player2_name,
    r.game_state,
    r.status AS old_status,
    LEAST(r.player1_name, r.player2_name) AS u1,
    GREATEST(r.player1_name, r.player2_name) AS u2
  FROM rooms r
  WHERE r.player1_name IS NOT NULL
    AND r.player2_name IS NOT NULL
    AND r.player1_name <> r.player2_name
),
msg_counts AS (
  SELECT room_id AS old_room_id, COUNT(*)::int AS cnt
  FROM messages
  GROUP BY room_id
),
ranked AS (
  SELECT
    p.*,
    COALESCE(mc.cnt, 0) AS msg_cnt,
    ROW_NUMBER() OVER (
      PARTITION BY p.u1, p.u2
      ORDER BY COALESCE(mc.cnt, 0) DESC, p.old_created_at ASC
    ) AS rn
  FROM room_pairs p
  LEFT JOIN msg_counts mc ON mc.old_room_id = p.old_room_id
),
keepers AS (
  SELECT
    old_room_id,
    u1,
    u2,
    ('room_' || u1 || '_' || u2) AS new_room_id,
    old_code,
    old_created_at,
    game_state,
    old_status
  FROM ranked
  WHERE rn = 1
),
mapping AS (
  SELECT
    r.old_room_id,
    k.new_room_id,
    k.u1,
    k.u2,
    k.old_code
  FROM ranked r
  JOIN keepers k
    ON k.u1 = r.u1 AND k.u2 = r.u2
)
-- 4a) Insert rooms_v2 from keepers
INSERT INTO rooms_v2 (id, code, user1_id, user2_id, created_at)
SELECT
  k.new_room_id,
  k.old_code,
  k.u1,
  k.u2,
  k.old_created_at
FROM keepers k
ON CONFLICT (id) DO NOTHING;

-- 4b) Migrate messages into messages_v2, remapping room_id to keeper deterministic room id
INSERT INTO messages_v2 (
  id, room_id, player_name, text, created_at,
  read_at, reply_to, reactions,
  message_type, media_url, latitude, longitude,
  expires_at
)
SELECT
  m.id,
  mp.new_room_id,
  m.player_name,
  m.text,
  m.created_at,
  m.read_at,
  m.reply_to,
  m.reactions,
  m.message_type,
  m.media_url,
  m.latitude,
  m.longitude,
  m.expires_at
FROM messages m
JOIN mapping mp ON mp.old_room_id = m.room_id;

-- 4c) Create initial game_session per keeper room using keeper's last known room.game_state
INSERT INTO game_sessions (room_id, created_at, status, board_state)
SELECT
  k.new_room_id,
  k.old_created_at,
  CASE WHEN k.old_status = 'finished' THEN 'finished' ELSE 'active' END,
  k.game_state
FROM keepers k
ON CONFLICT DO NOTHING;

-- 5) Swap tables (optional; keep old as backup)
-- NOTE: If you have external dependencies/FKs/policies, adjust accordingly.
ALTER TABLE messages RENAME TO messages_old;
ALTER TABLE rooms RENAME TO rooms_old;

ALTER TABLE rooms_v2 RENAME TO rooms;
ALTER TABLE messages_v2 RENAME TO messages;

-- 6) Realtime publication (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
  END IF;
END $$;

COMMIT;

