import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKey = (nickname) => `@vault_chat_read_cursor_v1_${nickname}`;

/** @type {Set<(nickname: string, map: Record<string, string>) => void>} */
const listeners = new Set();

export function subscribeReadCursors(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyReadCursors(nickname, map) {
  listeners.forEach((fn) => {
    try {
      fn(nickname, map);
    } catch {
      // ignore
    }
  });
}

/** @returns {Promise<Record<string, string>>} roomId → last seen created_at (ISO) или legacy message id */
export async function loadReadCursors(nickname) {
  if (!nickname) return {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(nickname));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function persistReadCursors(nickname, map) {
  if (!nickname) return;
  try {
    await AsyncStorage.setItem(storageKey(nickname), JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function compareMessageIds(a, b) {
  if (a == null || b == null) {
    if (a == null && b == null) return 0;
    return a == null ? -1 : 1;
  }
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

function parseCursorMs(cursor) {
  const ms = Date.parse(cursor);
  return Number.isNaN(ms) ? null : ms;
}

/** Непрочитано в списке чатов: последнее входящее новее локального cursor. */
export function isChatLastMessageUnread(lastMessage, nickname, roomId, cursors) {
  if (!lastMessage || !roomId || !nickname) return false;
  if (lastMessage.player_name === nickname) return false;
  const cursor = cursors?.[roomId];
  if (cursor == null || cursor === '') return true;

  const lastMs = parseCursorMs(lastMessage.created_at || '');
  const cursorMs = parseCursorMs(cursor);
  if (lastMs != null && cursorMs != null) {
    return lastMs > cursorMs;
  }

  return compareMessageIds(lastMessage.id, cursor) > 0;
}

/** Пометить прочитанным до сообщения (cursor = created_at, fallback id). */
export async function markRoomReadThrough(nickname, roomId, messageId, createdAt) {
  if (!nickname || !roomId || messageId == null) return null;

  const next = createdAt ? String(createdAt) : String(messageId);
  const map = await loadReadCursors(nickname);
  const prev = map[roomId];

  if (prev != null && prev !== '') {
    const nextMs = parseCursorMs(next);
    const prevMs = parseCursorMs(prev);
    if (nextMs != null && prevMs != null) {
      if (nextMs <= prevMs) return map;
    } else if (compareMessageIds(messageId, prev) <= 0) {
      return map;
    }
  }

  map[roomId] = next;
  await persistReadCursors(nickname, map);
  notifyReadCursors(nickname, map);
  return map;
}

export async function clearRoomReadCursor(nickname, roomId) {
  if (!nickname || !roomId) return null;
  const map = await loadReadCursors(nickname);
  if (!map[roomId]) return map;
  delete map[roomId];
  await persistReadCursors(nickname, map);
  notifyReadCursors(nickname, map);
  return map;
}

export async function clearReadCursors(nickname) {
  if (!nickname) return;
  try {
    await AsyncStorage.removeItem(storageKey(nickname));
  } catch {
    // ignore
  }
  notifyReadCursors(nickname, {});
}
