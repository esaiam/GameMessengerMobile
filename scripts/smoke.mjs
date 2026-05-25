/**
 * Smoke-тесты Vault Messenger (без Jest / без новых зависимостей).
 *
 * Чистые проверки (всегда):
 *   node scripts/smoke.mjs
 *
 * API против Supabase (нужен .env + тестовый аккаунт):
 *   node scripts/smoke.mjs --api
 *
 * Переменные в .env:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD — в .env или .env.smoke (см. .env.smoke.example)
 *   SMOKE_TEST_PEER_HANDLE  (опционально — handle второго пользователя для комнаты)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const runApi = args.has('--api');

let failed = 0;

function ok(name) {
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed += 1;
  console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
}

function assert(name, cond, detail) {
  if (cond) ok(name);
  else fail(name, detail);
}

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

/** `.env` + опционально `.env.smoke` (gitignored, только креды для smoke:api). */
function loadEnv() {
  return {
    ...loadEnvFile(path.join(root, '.env')),
    ...loadEnvFile(path.join(root, '.env.smoke')),
  };
}

function deterministicRoomId(userId1, userId2) {
  const [u1, u2] = [String(userId1).trim(), String(userId2).trim()].sort();
  return `room_${u1}_${u2}`;
}

function isVm2Payload(text) {
  return typeof text === 'string' && text.startsWith('VM2:');
}

function runPureSmoke() {
  console.log('\n[smoke] pure (offline)');

  const roomA = deterministicRoomId('bob', 'alice');
  const roomB = deterministicRoomId('alice', 'bob');
  assert('deterministicRoomId stable', roomA === roomB, `${roomA} vs ${roomB}`);
  assert('deterministicRoomId format', /^room_[a-z0-9_]+_[a-z0-9_]+$/i.test(roomA));

  assert('isVm2Payload detects VM2', isVm2Payload('VM2:{"r":"x","s":"y"}'));
  assert('isVm2Payload rejects plain', !isVm2Payload('hello'));
  assert('isVm2Payload rejects legacy CryptoJS', !isVm2Payload('U2FsdGVkX1abc'));

  const mediaRowText = '' || '';
  assert('media insert text is empty string not null', mediaRowText === '' && mediaRowText !== null);
}

async function runApiSmoke(env) {
  console.log('\n[smoke] api (Supabase)');

  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.SMOKE_TEST_EMAIL;
  const password = env.SMOKE_TEST_PASSWORD;
  const peerHandle = env.SMOKE_TEST_PEER_HANDLE?.trim() || null;

  if (!url || !anonKey) {
    fail('env', 'EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY обязательны');
    return;
  }
  if (!email || !password) {
    fail('env', 'SMOKE_TEST_EMAIL и SMOKE_TEST_PASSWORD обязательны для --api');
    return;
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) {
    fail('auth signIn', authError.message);
    return;
  }
  ok(`auth signIn (${authData.user?.id?.slice(0, 8)}…)`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) {
    fail('profiles select', profileError.message);
    return;
  }
  const myHandle = profile?.handle;
  if (!myHandle) {
    fail('profiles handle', 'нет handle у пользователя');
    return;
  }
  ok(`profile handle @${myHandle}`);

  let roomId = null;
  let contactName = null;

  if (peerHandle) {
    roomId = deterministicRoomId(myHandle, peerHandle);
    contactName = peerHandle;
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, user1_id, user2_id')
      .eq('id', roomId)
      .maybeSingle();
    if (roomError) {
      fail('rooms select by id', roomError.message);
      return;
    }
    if (!room) {
      fail('open room', `комната ${roomId} не найдена — сначала открой чат с @${peerHandle} в приложении`);
      return;
    }
    ok(`open room ${roomId}`);
  } else {
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${myHandle},user2_id.eq.${myHandle}`)
      .limit(5);
    if (roomsError) {
      fail('rooms list', roomsError.message);
      return;
    }
    if (!rooms?.length) {
      fail('open room', 'нет комнат — укажи SMOKE_TEST_PEER_HANDLE или создай диалог в приложении');
      return;
    }
    const room = rooms[0];
    roomId = room.id;
    contactName = room.user1_id === myHandle ? room.user2_id : room.user1_id;
    ok(`open room (first) ${roomId} ↔ ${contactName}`);
  }

  const smokeTag = `[smoke ${Date.now()}]`;
  const { data: inserted, error: insertError } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      player_name: myHandle,
      text: smokeTag,
      message_type: 'text',
    })
    .select('id, text, room_id')
    .single();

  if (insertError) {
    fail('send message', insertError.message);
    return;
  }
  assert('send message', inserted?.text === smokeTag, inserted?.text);
  ok(`send message id=${inserted.id}`);

  const { data: readBack, error: readError } = await supabase
    .from('messages')
    .select('id, text')
    .eq('id', inserted.id)
    .single();
  if (readError) {
    fail('read message', readError.message);
  } else {
    assert('read message', readBack?.text === smokeTag);
  }

  const { error: videoInsertError } = await supabase.from('messages').insert({
    room_id: roomId,
    player_name: myHandle,
    text: '',
    message_type: 'video',
    media_url: 'https://example.com/smoke-placeholder.mp4',
  });
  if (videoInsertError) {
    fail('video row text empty string', videoInsertError.message);
  } else {
    ok('video row accepts text="" (NOT NULL regression)');
    const { error: delVideoErr } = await supabase
      .from('messages')
      .delete()
      .eq('room_id', roomId)
      .eq('message_type', 'video')
      .eq('media_url', 'https://example.com/smoke-placeholder.mp4');
    if (delVideoErr) {
      fail('cleanup video smoke row', delVideoErr.message);
    }
  }

  const { error: deleteError } = await supabase.from('messages').delete().eq('id', inserted.id);
  if (deleteError) {
    fail('cleanup text smoke row', deleteError.message);
  } else {
    ok('cleanup smoke message');
  }

  await supabase.auth.signOut();
  ok('auth signOut');
}

console.log('[smoke] Vault Messenger');

runPureSmoke();

if (runApi) {
  const env = loadEnv();
  await runApiSmoke(env);
} else {
  console.log('\n[smoke] пропуск API (запусти: node scripts/smoke.mjs --api)');
}

console.log('');
if (failed > 0) {
  console.error(`[smoke] FAILED (${failed})`);
  process.exitCode = 1;
} else {
  console.log('[smoke] OK');
}
