import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPeerProfileAvatar, normalizePeerHandle } from '../lib/profileAvatarPeer';

/** @type {Map<string, { url: string | null, avatarUpdatedAt: string | null }>} */
const peerAvatarMemoryCache = new Map();

/**
 * @param {string | null | undefined} handle peer @handle (не локальный alias)
 * @param {{ enabled?: boolean, refreshOnFocus?: boolean }} [options]
 */
export function usePeerAvatar(handle, options = {}) {
  const { enabled = true, refreshOnFocus = false } = options;
  const normalized = useMemo(() => normalizePeerHandle(handle), [handle]);
  const cached = normalized ? peerAvatarMemoryCache.get(normalized) : null;
  const [avatarUri, setAvatarUri] = useState(cached?.url ?? null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !normalized) {
      setAvatarUri(null);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchPeerProfileAvatar(normalized);
      const url = result?.url ?? null;
      if (result) {
        peerAvatarMemoryCache.set(normalized, {
          url,
          avatarUpdatedAt: result.avatarUpdatedAt ?? null,
        });
      } else {
        peerAvatarMemoryCache.delete(normalized);
      }
      setAvatarUri(url);
    } catch {
      /* keep previous uri */
    } finally {
      setLoading(false);
    }
  }, [enabled, normalized]);

  useEffect(() => {
    const cachedEntry = normalized ? peerAvatarMemoryCache.get(normalized) : null;
    setAvatarUri(cachedEntry?.url ?? null);
    void refresh();
  }, [normalized, enabled, refresh]);

  useFocusEffect(
    useCallback(() => {
      if (!refreshOnFocus) return undefined;
      void refresh();
      return undefined;
    }, [refresh, refreshOnFocus]),
  );

  return { avatarUri, loading, refresh };
}

/** @param {string | null | undefined} handle */
export function invalidatePeerAvatarCache(handle) {
  const normalized = normalizePeerHandle(handle);
  if (normalized) peerAvatarMemoryCache.delete(normalized);
}
