/**
 * Read-only audit: messages wiped? leftover rows / orphans?
 * Usage: node scripts/db-chat-audit.mjs
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
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
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
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Need EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

function row(label, value, note = '') {
  const pad = label.padEnd(32);
  console.log(`  ${pad} ${String(value).padStart(8)}${note ? `  — ${note}` : ''}`);
}

console.log('\n[db-audit] Vault Messenger — chat data snapshot\n');

// messages total (head only — count via select limit trick)
const { count: msgCount, error: msgErr } = await supabase
  .from('messages')
  .select('*', { count: 'exact', head: true });
if (msgErr) {
  console.error('messages count:', msgErr.message);
} else {
  row('messages (rows)', msgCount ?? '?');
}

const { data: msgSample, error: sampleErr } = await supabase
  .from('messages')
  .select('id, room_id, message_type, created_at, player_name, hidden_for')
  .order('created_at', { ascending: false })
  .limit(5);
if (sampleErr) {
  row('messages sample', 'ERR', sampleErr.message);
} else if (!msgSample?.length) {
  row('messages sample', 0, 'таблица пустая или RLS скрывает');
} else {
  console.log('\n  Последние сообщения (до 5):');
  for (const m of msgSample) {
    const hf = Array.isArray(m.hidden_for) ? m.hidden_for.length : 0;
    console.log(`    ${m.created_at?.slice(0, 19)}  ${m.message_type}  room=${m.room_id?.slice(0, 24)}…  hidden_for=${hf}`);
  }
}

const { count: roomCount } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
row('rooms', roomCount ?? '?');

const { data: rooms, error: roomsErr } = await supabase
  .from('rooms')
  .select('id, last_message_id, last_message_at, thread_cleared_at')
  .limit(200);
if (roomsErr) {
  row('rooms detail', 'ERR', roomsErr.message);
} else {
  const withLast = (rooms || []).filter((r) => r.last_message_id || r.last_message_at);
  const withThreadClear = (rooms || []).filter((r) => r.thread_cleared_at);
  row('rooms w/ last_message_*', withLast.length, 'preview в списке чатов');
  row('rooms w/ thread_cleared_at', withThreadClear.length, 'очищена лента на сервере');
}

const { count: hiddenCount, error: hiddenErr } = await supabase
  .from('hidden_chat_rooms')
  .select('*', { count: 'exact', head: true });
if (hiddenErr) {
  row('hidden_chat_rooms', 'ERR/n/a', hiddenErr.message.includes('does not exist') ? 'таблицы нет' : hiddenErr.message);
} else {
  row('hidden_chat_rooms', hiddenCount ?? 0, 'скрыты из списка чатов');
}

const { count: gsCount } = await supabase
  .from('game_sessions')
  .select('*', { count: 'exact', head: true });
row('game_sessions', gsCount ?? '?');

// Storage bucket object count — needs authenticated or list; try anon list limited
const { data: buckets } = await supabase.storage.from('chat-media').list('', { limit: 1 });
row('chat-media storage reachable', buckets != null ? 'yes' : 'no', 'orphan files не считаем без service_role');

console.log('\n[db-audit] Интерпретация:');
console.log('  • messages=0 → wipe сработал, истории нет');
console.log('  • messages>0 но чаты пустые → hidden_for / thread_cleared / hidden_chat_rooms / кэш клиента');
console.log('  • rooms w/ last_message_* > 0 при messages=0 → мусор в rooms (не синхронизировано)\n');
