/**
 * Verify rooms.pinned_message_id exists on Supabase (PostgREST schema + UPDATE).
 * Usage: node scripts/check-pinned-message-column.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(root, '.env.smoke')),
};

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = env.SMOKE_TEST_EMAIL;
const password = env.SMOKE_TEST_PASSWORD;

if (!url || !anonKey || !email || !password) {
  console.error('Need EXPO_PUBLIC_SUPABASE_* and SMOKE_TEST_EMAIL/PASSWORD in .env or .env.smoke');
  process.exit(1);
}

console.log('Supabase URL:', url);

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function report(label, error, extra = '') {
  if (error) {
    console.log(`FAIL  ${label}: [${error.code}] ${error.message}${extra}`);
    return false;
  }
  console.log(`OK    ${label}${extra}`);
  return true;
}

const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (!report('auth', authError)) process.exit(1);

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('handle')
  .eq('id', (await supabase.auth.getUser()).data.user.id)
  .single();
if (!report('profile', profileError)) process.exit(1);

const handle = profile.handle;
const { data: rooms, error: roomsListError } = await supabase
  .from('rooms')
  .select('id, pinned_message_id')
  .or(`user1_id.eq.${handle},user2_id.eq.${handle}`)
  .limit(1);

if (!report('SELECT rooms.pinned_message_id (PostgREST schema)', roomsListError)) {
  console.log('\n→ Колонка отсутствует в PostgREST schema cache или в БД.');
  console.log('→ Выполни docs/migrations/20260531_rooms_pinned_message.sql');
  console.log('→ Затем: NOTIFY pgrst, \'reload schema\';');
  process.exit(1);
}

if (!rooms?.length) {
  console.log('WARN  no rooms for user — skip UPDATE test');
  process.exit(0);
}

const roomId = rooms[0].id;
const prevPin = rooms[0].pinned_message_id ?? null;

const { error: pinError } = await supabase
  .from('rooms')
  .update({ pinned_message_id: prevPin })
  .eq('id', roomId);

if (!report('UPDATE rooms.pinned_message_id (RLS + column)', pinError)) {
  if (pinError?.code === '42501' || /row-level security|permission denied/i.test(pinError?.message || '')) {
    console.log('\n→ Колонка есть, но RLS блокирует UPDATE на rooms.');
    console.log('→ Добавь политику UPDATE для участников комнаты (см. комментарий в миграции).');
  }
  process.exit(1);
}

await supabase.from('rooms').update({ pinned_message_id: prevPin }).eq('id', roomId);

const fakeId = '00000000-0000-0000-0000-000000000001';
const { error: fkError } = await supabase
  .from('rooms')
  .update({ pinned_message_id: fakeId })
  .eq('id', roomId);
if (fkError) {
  console.log(`INFO  FK probe (fake message id): [${fkError.code}] ${fkError.message}`);
}
await supabase.from('rooms').update({ pinned_message_id: prevPin }).eq('id', roomId);

await supabase.auth.signOut();
console.log('\n[check-pinned] rooms.pinned_message_id доступна — pin path should work.');

