import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@room_msgs_v1_';
/** Последние N сообщений на комнату — plain text, без optimistic. */
export const ROOM_MESSAGES_DISK_CAP = 120;

function key(roomId) {
  return `${PREFIX}${roomId}`;
}

/** @param {unknown[]} messages */
export function stripRoomMessagesForDisk(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((m) => !m?._isOptimistic).slice(-ROOM_MESSAGES_DISK_CAP);
}

/** @returns {Promise<unknown[] | null>} */
export async function loadRoomMessagesDisk(roomId) {
  if (!roomId) return null;
  try {
    const raw = await AsyncStorage.getItem(key(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** @param {unknown[]} messages */
export async function saveRoomMessagesDisk(roomId, messages) {
  if (!roomId || !messages) return;
  try {
    const payload = stripRoomMessagesForDisk(messages);
    await AsyncStorage.setItem(key(roomId), JSON.stringify(payload));
  } catch {
    /* игнорируем ошибки записи кэша */
  }
}

export async function clearRoomMessagesDisk(roomId) {
  if (!roomId) return;
  try {
    await AsyncStorage.removeItem(key(roomId));
  } catch {}
}
