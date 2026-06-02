import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const LEGACY_KEY = (nickname) => `@vault_hidden_chats_${nickname}`;
const MIGRATED_FLAG = (nickname) => `@vault_hidden_chats_migrated_v1_${nickname}`;

const CACHE_MS = 30_000;
/** @type {Map<string, { at: number, set: Set<string> }>} */
const cacheByNickname = new Map();

export function invalidateHiddenChatsCache(nickname) {
  if (nickname) cacheByNickname.delete(nickname);
  else cacheByNickname.clear();
}

async function readLegacyHiddenRoomIds(nickname) {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY(nickname));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Однократная миграция AsyncStorage → hidden_chat_rooms. */
async function migrateLegacyHiddenToServer(nickname) {
  if (!nickname) return;
  try {
    const flag = await AsyncStorage.getItem(MIGRATED_FLAG(nickname));
    if (flag === '1') return;

    const roomIds = await readLegacyHiddenRoomIds(nickname);
    for (const roomId of roomIds) {
      const { error } = await supabase.from('hidden_chat_rooms').insert({ room_id: roomId });
      if (error && error.code !== '23505' && __DEV__) {
        console.warn('[hiddenChats] migrate insert:', error.message);
      }
    }

    await AsyncStorage.removeItem(LEGACY_KEY(nickname));
    await AsyncStorage.setItem(MIGRATED_FLAG(nickname), '1');
  } catch (e) {
    if (__DEV__) console.warn('[hiddenChats] migrate failed:', e?.message || e);
  }
}

/** Комнаты, скрытые из списка чатов («удалить переписку» только у меня). */
export async function getHiddenChatRoomIds(nickname) {
  if (!nickname) return new Set();

  const now = Date.now();
  const cached = cacheByNickname.get(nickname);
  if (cached && now - cached.at < CACHE_MS) {
    return cached.set;
  }

  await migrateLegacyHiddenToServer(nickname);

  const { data, error } = await supabase.from('hidden_chat_rooms').select('room_id');

  if (error) {
    if (__DEV__) console.warn('[hiddenChats] fetch:', error.message);
    return cached?.set ?? new Set();
  }

  const set = new Set((data || []).map((row) => row.room_id).filter(Boolean));
  cacheByNickname.set(nickname, { at: now, set });
  return set;
}

export async function hideChatRoom(nickname, roomId) {
  if (!nickname || !roomId) return;

  const { error } = await supabase.from('hidden_chat_rooms').insert({ room_id: roomId });

  if (error && error.code !== '23505') {
    throw error;
  }

  invalidateHiddenChatsCache(nickname);
}

export async function unhideChatRoom(nickname, roomId) {
  if (!nickname || !roomId) return;

  const { error } = await supabase
    .from('hidden_chat_rooms')
    .delete()
    .eq('room_id', roomId);

  if (error) {
    throw error;
  }

  invalidateHiddenChatsCache(nickname);
}
