import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { unhideChatRoom } from './hiddenChats';
import { normalizeUserPair } from '../utils/roomIds';

const LEGACY_KEY = (nickname) => `@vault_blocked_${nickname}`;
const MIGRATED_FLAG = (nickname) => `@vault_blocked_migrated_v1_${nickname}`;

const CACHE_MS = 30_000;
/** @type {Map<string, { at: number, set: Set<string> }>} */
const cacheByNickname = new Map();

export function invalidateBlockedPeersCache(nickname) {
  if (nickname) cacheByNickname.delete(nickname);
  else cacheByNickname.clear();
}

/** Согласовано с триггером blocked_peers: lower(btrim(...)). */
export function normalizePeerHandle(handle) {
  return String(handle || '').trim().toLowerCase();
}

async function readLegacyBlockedHandles(nickname) {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY(nickname));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Однократная миграция AsyncStorage → blocked_peers. */
async function migrateLegacyBlocksToServer(nickname) {
  if (!nickname) return;
  try {
    const flag = await AsyncStorage.getItem(MIGRATED_FLAG(nickname));
    if (flag === '1') return;

    const peers = await readLegacyBlockedHandles(nickname);
    for (const blockedHandle of peers) {
      const { error } = await supabase
        .from('blocked_peers')
        .insert({ blocked_handle: blockedHandle });
      if (error && error.code !== '23505' && __DEV__) {
        console.warn('[blocked] migrate insert:', error.message);
      }
    }

    await AsyncStorage.removeItem(LEGACY_KEY(nickname));
    await AsyncStorage.setItem(MIGRATED_FLAG(nickname), '1');
  } catch (e) {
    if (__DEV__) console.warn('[blocked] migrate failed:', e?.message || e);
  }
}

/** @returns {Promise<Set<string>>} */
export async function getBlockedPeers(nickname) {
  if (!nickname) return new Set();

  const now = Date.now();
  const cached = cacheByNickname.get(nickname);
  if (cached && now - cached.at < CACHE_MS) {
    return cached.set;
  }

  await migrateLegacyBlocksToServer(nickname);

  const { data, error } = await supabase
    .from('blocked_peers')
    .select('blocked_handle');

  if (error) {
    if (__DEV__) console.warn('[blocked] fetch:', error.message);
    return cached?.set ?? new Set();
  }

  const set = new Set((data || []).map((row) => row.blocked_handle).filter(Boolean));
  cacheByNickname.set(nickname, { at: now, set });
  return set;
}

export async function isBlocked(nickname, peerHandle) {
  if (!nickname || !peerHandle) return false;
  const set = await getBlockedPeers(nickname);
  return set.has(normalizePeerHandle(peerHandle));
}

export async function blockPeer(nickname, peerHandle) {
  if (!nickname || !peerHandle) return;

  const { error } = await supabase
    .from('blocked_peers')
    .insert({ blocked_handle: peerHandle });

  if (error && error.code !== '23505') {
    throw error;
  }

  invalidateBlockedPeersCache(nickname);
}

export async function unblockPeer(nickname, peerHandle) {
  if (!nickname || !peerHandle) return;

  const { error } = await supabase
    .from('blocked_peers')
    .delete()
    .eq('blocked_handle', normalizePeerHandle(peerHandle));

  if (error) {
    throw error;
  }

  invalidateBlockedPeersCache(nickname);
  const { roomId } = normalizeUserPair(nickname, peerHandle);
  if (roomId) await unhideChatRoom(nickname, roomId);
}
