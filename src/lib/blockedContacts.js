import AsyncStorage from '@react-native-async-storage/async-storage';
import { unhideChatRoom } from './hiddenChats';
import { normalizeUserPair } from '../utils/roomIds';

const key = (nickname) => `@vault_blocked_${nickname}`;

/** @returns {Promise<Set<string>>} */
export async function getBlockedPeers(nickname) {
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

export async function isBlocked(nickname, peerHandle) {
  if (!nickname || !peerHandle) return false;
  const set = await getBlockedPeers(nickname);
  return set.has(peerHandle);
}

export async function blockPeer(nickname, peerHandle) {
  if (!nickname || !peerHandle) return;
  const set = await getBlockedPeers(nickname);
  set.add(peerHandle);
  await AsyncStorage.setItem(key(nickname), JSON.stringify([...set]));
}

export async function unblockPeer(nickname, peerHandle) {
  if (!nickname || !peerHandle) return;
  const set = await getBlockedPeers(nickname);
  set.delete(peerHandle);
  await AsyncStorage.setItem(key(nickname), JSON.stringify([...set]));
  const { roomId } = normalizeUserPair(nickname, peerHandle);
  if (roomId) await unhideChatRoom(nickname, roomId);
}
