import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { supabase } from './supabase';
import { PROFILE_AVATAR_BUCKET, PROFILE_AVATAR_OBJECT_NAME } from './profileAvatarUpload';

export const PROFILE_AVATAR_LOCAL_FILENAME = 'profile_avatar.jpg';
export const AVATAR_STORAGE_KEY = '@vault_local_avatar_path';
export const AVATAR_SERVER_UPDATED_AT_KEY = '@vault_local_avatar_server_updated_at';

/** @param {string | null | undefined} uri */
export function stripAvatarCacheQuery(uri) {
  if (!uri) return null;
  const q = uri.indexOf('?');
  return q === -1 ? uri : uri.slice(0, q);
}

/** @param {string | null | undefined} path @param {number | string} bust */
export function withAvatarCacheBust(path, bust) {
  const base = stripAvatarCacheQuery(path);
  if (!base) return null;
  return `${base}?v=${bust}`;
}

/** @param {string | null | undefined} iso */
export function avatarUpdatedAtMs(iso) {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
}

/** @param {string} avatarPath storage object path */
export function profileAvatarPublicUrl(avatarPath) {
  const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(avatarPath);
  return data?.publicUrl ?? null;
}

/**
 * @returns {Promise<{ avatarPath: string | null, avatarUpdatedAt: string | null } | null>}
 * null — нет сессии или ошибка fetch
 */
export async function fetchOwnProfileAvatarMeta() {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user?.id) return null;

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('avatar_path, avatar_updated_at')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profErr) {
    if (__DEV__) console.warn('[profileAvatar] sync select:', profErr.message);
    return null;
  }

  return {
    avatarPath: profile?.avatar_path ?? null,
    avatarUpdatedAt: profile?.avatar_updated_at ?? null,
  };
}

/** @param {string} avatarPath @param {string | null | undefined} avatarUpdatedAt */
async function downloadProfileAvatarToDocument(avatarPath, avatarUpdatedAt) {
  const publicUrl = profileAvatarPublicUrl(avatarPath);
  if (!publicUrl) throw new Error('no_public_url');

  const bust = avatarUpdatedAtMs(avatarUpdatedAt) || Date.now();
  const url = withAvatarCacheBust(publicUrl, bust);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch_${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const destFile = new File(Paths.document, PROFILE_AVATAR_LOCAL_FILENAME);
  if (destFile.exists) {
    await destFile.delete();
  }
  destFile.create();
  await destFile.write(bytes);
  return destFile.uri;
}

export async function clearLocalProfileAvatarFiles() {
  try {
    const stored = stripAvatarCacheQuery(await AsyncStorage.getItem(AVATAR_STORAGE_KEY));
    if (stored) {
      const file = new File(stored);
      if (file.exists) {
        await file.delete();
      }
    }
  } catch {
    /* ignore */
  }
  await AsyncStorage.multiRemove([AVATAR_STORAGE_KEY, AVATAR_SERVER_UPDATED_AT_KEY]);
}

/** @param {string} updatedAt ISO timestamp from profiles.avatar_updated_at */
export async function markProfileAvatarSynced(updatedAt) {
  if (!updatedAt) {
    await AsyncStorage.removeItem(AVATAR_SERVER_UPDATED_AT_KEY);
    return;
  }
  await AsyncStorage.setItem(AVATAR_SERVER_UPDATED_AT_KEY, updatedAt);
}

/**
 * Сверка локального файла с profiles + при необходимости download.
 * @returns {Promise<{ uri: string | null, cacheBust: number }>}
 */
export async function syncOwnProfileAvatarFromServer() {
  const meta = await fetchOwnProfileAvatarMeta();
  if (!meta) {
    return { uri: null, cacheBust: 0, usedLocalFallback: false };
  }

  const { avatarPath, avatarUpdatedAt } = meta;

  if (!avatarPath) {
    await clearLocalProfileAvatarFiles();
    return { uri: null, cacheBust: 0, usedLocalFallback: false };
  }

  const storedPath = stripAvatarCacheQuery(await AsyncStorage.getItem(AVATAR_STORAGE_KEY));
  const storedUpdatedAt = await AsyncStorage.getItem(AVATAR_SERVER_UPDATED_AT_KEY);
  const localFile = storedPath ? new File(storedPath) : null;
  const hasLocal = Boolean(localFile?.exists);

  const serverTs = avatarUpdatedAtMs(avatarUpdatedAt);
  const localTs = avatarUpdatedAtMs(storedUpdatedAt);
  const needsDownload =
    !hasLocal ||
    !storedUpdatedAt ||
    !serverTs ||
    localTs !== serverTs;

  if (!needsDownload && storedPath) {
    return {
      uri: withAvatarCacheBust(storedPath, serverTs || Date.now()),
      cacheBust: serverTs || Date.now(),
      usedLocalFallback: false,
    };
  }

  try {
    const localUri = await downloadProfileAvatarToDocument(avatarPath, avatarUpdatedAt);
    await AsyncStorage.setItem(AVATAR_STORAGE_KEY, localUri);
    await markProfileAvatarSynced(avatarUpdatedAt);
    const bust = serverTs || Date.now();
    return {
      uri: withAvatarCacheBust(localUri, bust),
      cacheBust: bust,
      usedLocalFallback: false,
    };
  } catch (e) {
    if (__DEV__) console.warn('[profileAvatar] sync download:', e?.message || e);
    if (hasLocal && storedPath) {
      return {
        uri: withAvatarCacheBust(storedPath, avatarUpdatedAtMs(storedUpdatedAt) || 0),
        cacheBust: avatarUpdatedAtMs(storedUpdatedAt) || 0,
        usedLocalFallback: true,
      };
    }
    return { uri: null, cacheBust: 0, usedLocalFallback: false };
  }
}
