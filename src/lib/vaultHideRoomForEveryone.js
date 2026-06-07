import { supabase } from './supabase';

const RPC_MISSING =
  /could not find the function|schema cache|PGRST202/i;

function rpcMissingMessage(error) {
  return (
    'На Supabase не применена миграция vault_hide_room_for_everyone. ' +
    'SQL Editor → Run файл supabase/migrations/20260610_vault_hide_room_for_everyone.sql'
  );
}

/** Серверное «удалить у всех»: hidden_for + thread_cleared_at (обходит RLS на messages). */
export async function vaultHideRoomForEveryone(roomId) {
  if (!roomId) throw new Error('roomId required');
  const { error } = await supabase.rpc('vault_hide_room_for_everyone', {
    p_room_id: roomId,
  });
  if (error) {
    if (RPC_MISSING.test(error.message || '')) {
      throw new Error(rpcMissingMessage(error));
    }
    throw error;
  }
}
