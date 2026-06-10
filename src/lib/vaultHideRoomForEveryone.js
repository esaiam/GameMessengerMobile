import { supabase } from './supabase';

const RPC_MISSING =
  /could not find the function|schema cache|PGRST202/i;

function rpcMissingMessage(fnName = 'vault_hide_room_for_everyone') {
  if (fnName === 'vault_clear_thread_for_everyone') {
    return (
      'На Supabase не применена миграция vault_clear_thread_for_everyone. ' +
      'SQL Editor → Run docs/migrations/20260614_clear_thread_vs_delete_chat.sql'
    );
  }
  return (
    'На Supabase не применена миграция vault_hide_room_for_everyone. ' +
    'SQL Editor → Run docs/migrations/20260610_vault_hide_room_for_everyone.sql'
  );
}

/** Человекочитаемый текст для ошибок RPC «удалить/очистить у всех». */
export function vaultHideRoomErrorMessage(error, rpcName = 'vault_hide_room_for_everyone') {
  const msg = String(error?.message || '').trim();
  const code = error?.code;

  if (RPC_MISSING.test(msg)) {
    return rpcMissingMessage(rpcName);
  }
  if (code === '42501' || /not_authenticated/i.test(msg)) {
    return 'Сессия истекла или профиль не найден. Выйди из приложения и войди снова.';
  }
  if (/not_room_participant/i.test(msg)) {
    return (
      'Не удалось удалить у всех: комната не найдена или ты не участник. ' +
      'Закрой чат и открой диалог снова из Контактов.'
    );
  }
  if (/invalid_room_id/i.test(msg)) {
    return 'Не удалось удалить у всех: некорректный идентификатор комнаты.';
  }
  if (/permission denied|row-level security/i.test(msg)) {
    return 'Нет прав на удаление. Убедись, что вошёл в аккаунт и это твой чат.';
  }
  if (/messages_v2_reply_to_fkey|reply_to_fkey|foreign key constraint/i.test(msg)) {
    return (
      'Не удалось удалить: в переписке есть ответы на сообщения. ' +
      'Примени миграцию docs/migrations/20260613_fix_purge_reply_to_fkey.sql на Supabase.'
    );
  }
  return msg || 'Не удалось удалить у всех';
}

/** Серверная очистка переписки у обоих (чат остаётся в списке). */
export async function vaultClearThreadForEveryone(roomId) {
  if (!roomId) throw new Error('roomId required');
  const { error } = await supabase.rpc('vault_clear_thread_for_everyone', {
    p_room_id: roomId,
  });
  if (error) {
    throw new Error(vaultHideRoomErrorMessage(error, 'vault_clear_thread_for_everyone'));
  }
}

/** Серверное «удалить чат у всех»: clear + скрыть из списка (hidden_chat_rooms). */
export async function vaultHideRoomForEveryone(roomId) {
  if (!roomId) throw new Error('roomId required');
  const { error } = await supabase.rpc('vault_hide_room_for_everyone', {
    p_room_id: roomId,
  });
  if (error) {
    throw new Error(vaultHideRoomErrorMessage(error));
  }
}
