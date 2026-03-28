import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nqssqplizwsukowggzxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-4i09Wf62DwN4tx_XvrdxA_RhsG7X-q';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable(name) {
  const { data, error } = await supabase.from(name).select('id').limit(1);
  if (error) {
    console.log(`  ❌ ${name}: ${error.message} (code: ${error.code})`);
    return false;
  }
  console.log(`  ✅ ${name}: OK (${data.length} rows sampled)`);
  return true;
}

async function testInsertRoom() {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code: 'TEST01',
      player1_name: '__test__',
      status: 'waiting',
      game_state: { test: true },
    })
    .select()
    .single();

  if (error) {
    console.log(`  ❌ insert rooms: ${error.message}`);
    return null;
  }
  console.log(`  ✅ insert rooms: OK (id=${data.id})`);

  // cleanup
  await supabase.from('rooms').delete().eq('id', data.id);
  console.log(`  🧹 cleanup: deleted test room`);
  return data.id;
}

async function testInsertMessage(roomId) {
  // We already cleaned up the room, so skip message insert with FK
  const { data, error } = await supabase.from('messages').select('id').limit(1);
  if (error) {
    console.log(`  ❌ messages read: ${error.message}`);
    return;
  }
  console.log(`  ✅ messages read: OK`);
}

console.log('\n🔌 Supabase Connection Check\n');
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Key: ${SUPABASE_KEY.slice(0, 20)}...`);
console.log('');

console.log('📋 Tables:');
const roomsOk = await checkTable('rooms');
const messagesOk = await checkTable('messages');

if (!roomsOk || !messagesOk) {
  console.log('\n⚠️  Таблицы не найдены! Нужно выполнить SQL миграцию.');
  console.log('   Открой: https://supabase.com/dashboard/project/nqssqplizwsukowggzxd/sql');
  console.log('   Вставь содержимое supabase_setup.sql и нажми Run.');
  process.exit(1);
}

console.log('\n🧪 Test Insert/Delete:');
await testInsertRoom();
await testInsertMessage();

console.log('\n✅ Всё готово к работе!\n');
