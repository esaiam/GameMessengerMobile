/**
 * One-off: verify messages.edited_at exists on Supabase (schema cache + UPDATE).
 * Usage: node scripts/check-edited-at-column.mjs
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

const { data: userData, error: userError } = await supabase.auth.getUser();
if (!report('getUser', userError)) process.exit(1);

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('handle')
  .eq('id', userData.user.id)
  .single();
if (!report('profile', profileError)) process.exit(1);

const handle = profile.handle;
const { data: rooms, error: roomsError } = await supabase
  .from('rooms')
  .select('id')
  .or(`user1_id.eq.${handle},user2_id.eq.${handle}`)
  .limit(1);
if (!report('rooms', roomsError) || !rooms?.length) process.exit(1);

const roomId = rooms[0].id;

const { error: schemaSelectError } = await supabase.from('messages').select('edited_at').limit(1);
if (!report('SELECT edited_at (PostgREST schema)', schemaSelectError)) process.exit(1);

const tag = `[edited_at-check ${Date.now()}]`;
const { data: inserted, error: insertError } = await supabase
  .from('messages')
  .insert({
    room_id: roomId,
    player_name: handle,
    text: tag,
    message_type: 'text',
  })
  .select('id, edited_at')
  .single();

if (!report('INSERT with edited_at in select', insertError, inserted ? ` → null=${inserted.edited_at == null}` : '')) {
  process.exit(1);
}

const editedAt = new Date().toISOString();
const { data: updated, error: updateError } = await supabase
  .from('messages')
  .update({ text: `${tag} edited`, edited_at: editedAt })
  .eq('id', inserted.id)
  .eq('player_name', handle)
  .select('id, edited_at')
  .single();

if (!report('UPDATE edited_at', updateError, updated ? ` → ${updated.edited_at}` : '')) {
  await supabase.from('messages').delete().eq('id', inserted.id);
  process.exit(1);
}

await supabase.from('messages').delete().eq('id', inserted.id);
report('cleanup', null);

await supabase.auth.signOut();
console.log('\n[check-edited-at] Prod has messages.edited_at — edit path should work.');
