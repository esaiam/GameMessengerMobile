/**
 * Быстрая диагностика: rooms, messages, search RPC
 * node scripts/diag-supabase.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const out = {};
  for (const file of ['.env', '.env.smoke']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  }
  return out;
}

const env = loadEnv();
const sb = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: env.SMOKE_TEST_EMAIL,
  password: env.SMOKE_TEST_PASSWORD,
});
if (authErr) {
  console.error('AUTH FAIL:', authErr.message);
  process.exit(1);
}

const { data: prof, error: profErr } = await sb
  .from('profiles')
  .select('handle')
  .eq('id', auth.user.id)
  .single();
console.log('profile:', profErr?.message ?? `@${prof?.handle}`);

const h = prof?.handle;
const { data: rooms, error: roomsErr } = await sb
  .from('rooms')
  .select('id, user1_id, user2_id')
  .or(`user1_id.eq.${h},user2_id.eq.${h}`)
  .limit(5);
console.log('rooms:', roomsErr?.message ?? `ok count=${rooms?.length}`, rooms?.map((r) => r.id));

const { data: rpc, error: rpcErr } = await sb.rpc('search_profiles_by_handle_prefix', {
  prefix: 'ma',
  lim: 5,
});
console.log('rpc search_profiles (ma):', rpcErr?.message ?? 'ok', rpc);

if (rooms?.[0]?.id) {
  const { data: msgs, error: msgsErr } = await sb
    .from('messages')
    .select('id, player_name')
    .eq('room_id', rooms[0].id)
    .limit(3);
  console.log('messages:', msgsErr?.message ?? `ok count=${msgs?.length}`);
}
