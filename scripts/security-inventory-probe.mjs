/**
 * Шаг 0.1 — частичная инвентаризация через anon API (не заменяет SQL Editor).
 * Usage: node scripts/security-inventory-probe.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (const line of text.split('\n')) {
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
  console.error('Need EXPO_PUBLIC_* in .env and SMOKE_TEST_* in .env.smoke');
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function row(label, status, detail = '') {
  console.log(`${status === 'OK' ? '✓' : status === 'WARN' ? '?' : '✗'} ${label}${detail ? `: ${detail}` : ''}`);
}

const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error('auth failed:', authError.message);
  process.exit(1);
}

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('handle, avatar_path, avatar_updated_at')
  .maybeSingle();

if (profileError) {
  row('profiles select', 'FAIL', profileError.message);
} else {
  row('profiles select', 'OK', `@${profile?.handle ?? '?'}`);
  if (profile && 'avatar_path' in profile) {
    row('profiles.avatar_path column', 'OK');
  }
}

const { error: dmColError } = await supabase.from('profiles').select('dm_policy').limit(0);
if (dmColError?.message?.includes('dm_policy')) {
  row('profiles.dm_policy column', 'MISSING', 'expected — only AsyncStorage today');
} else if (dmColError) {
  row('profiles.dm_policy column', 'FAIL', dmColError.message);
} else {
  row('profiles.dm_policy column', 'OK', 'column exists on prod');
}

const { error: bpError } = await supabase.from('blocked_peers').select('blocked_handle').limit(1);
if (bpError) {
  row('blocked_peers table + RLS', 'FAIL', bpError.message);
} else {
  row('blocked_peers table + RLS', 'OK', 'authenticated SELECT works');
}

row('delete_user_account RPC', 'SKIP', 'проверять только SQL Editor (блок D) — вызов RPC удалит аккаунт');

await supabase.auth.signOut();
console.log('\nДля триггеров, push body, legacy RLS — SQL Editor: docs/SECURITY_INVENTORY_0_1.sql');
