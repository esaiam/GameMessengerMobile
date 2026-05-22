import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (nickname) => `@vault_hidden_chats_${nickname}`;

/** Комнаты, скрытые из списка чатов («удалить переписку» только у меня). */
export async function getHiddenChatRoomIds(nickname) {
  if (!nickname) return new Set();
  try {
    const raw = await AsyncStorage.getItem(key(nickname));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

export async function hideChatRoom(nickname, roomId) {
  if (!nickname || !roomId) return;
  const set = await getHiddenChatRoomIds(nickname);
  set.add(roomId);
  await AsyncStorage.setItem(key(nickname), JSON.stringify([...set]));
}

export async function unhideChatRoom(nickname, roomId) {
  if (!nickname || !roomId) return;
  const set = await getHiddenChatRoomIds(nickname);
  set.delete(roomId);
  await AsyncStorage.setItem(key(nickname), JSON.stringify([...set]));
}
