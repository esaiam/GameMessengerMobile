import { supabase } from './supabase';
import { profileAvatarPublicUrl, withAvatarCacheBust } from './profileAvatarSync';

const PEER_HANDLE_RE = /^[a-z0-9_]{1,32}$/;

/** @param {string | null | undefined} handle with or without @ */
export function normalizePeerHandle(handle) {
  const raw = typeof handle === 'string' ? handle.trim().toLowerCase().replace(/^@+/, '') : '';
  return PEER_HANDLE_RE.test(raw) ? raw : null;
}

/**
 * @typedef {{ handle: string, url: string | null, avatarUpdatedAt: string | null }} PeerProfileAvatar
 */

/**
 * @param {string | null | undefined} handle peer @handle or handle
 * @returns {Promise<PeerProfileAvatar | null>} null — invalid handle, no profile, or RPC error
 */
export async function fetchPeerProfileAvatar(handle) {
  const normalized = normalizePeerHandle(handle);
  if (!normalized) return null;

  const { data, error } = await supabase.rpc('get_peer_profile_avatar', {
    p_handle: normalized,
  });

  if (error) {
    if (__DEV__) console.warn('[profileAvatar] peer rpc:', error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.handle) return null;

  const avatarPath = row.avatar_path ?? null;
  const avatarUpdatedAt = row.avatar_updated_at ?? null;

  if (!avatarPath) {
    return {
      handle: row.handle,
      url: null,
      avatarUpdatedAt: null,
    };
  }

  const publicUrl = profileAvatarPublicUrl(avatarPath);
  if (!publicUrl) {
    return {
      handle: row.handle,
      url: null,
      avatarUpdatedAt,
    };
  }

  const bust = avatarUpdatedAt ? Date.parse(avatarUpdatedAt) || Date.now() : Date.now();
  return {
    handle: row.handle,
    url: withAvatarCacheBust(publicUrl, bust),
    avatarUpdatedAt,
  };
}

/**
 * @param {string | null | undefined} handle
 * @returns {Promise<string | null>} public URL with cache bust, or null
 */
export async function fetchPeerAvatarUrl(handle) {
  const result = await fetchPeerProfileAvatar(handle);
  return result?.url ?? null;
}
