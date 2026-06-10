import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { uploadProfileAvatarFromLocalUri } from '../lib/profileAvatarUpload';
import {
  AVATAR_SERVER_UPDATED_AT_KEY,
  AVATAR_STORAGE_KEY,
  avatarUpdatedAtMs,
  markProfileAvatarSynced,
  PROFILE_AVATAR_LOCAL_FILENAME,
  stripAvatarCacheQuery,
  syncOwnProfileAvatarFromServer,
  withAvatarCacheBust,
} from '../lib/profileAvatarSync';
import { supabase } from '../lib/supabase';

const LocalAvatarContext = createContext(null);

export function LocalAvatarProvider({ children }) {
  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  uploadingRef.current = uploading;

  const applyLocalAvatarOnly = useCallback(async () => {
    try {
      const stored = stripAvatarCacheQuery(await AsyncStorage.getItem(AVATAR_STORAGE_KEY));
      if (!stored) {
        setAvatarUri(null);
        return;
      }
      const file = new File(stored);
      if (!file.exists) {
        await AsyncStorage.multiRemove([AVATAR_STORAGE_KEY, AVATAR_SERVER_UPDATED_AT_KEY]);
        setAvatarUri(null);
        return;
      }
      const syncedAt = await AsyncStorage.getItem(AVATAR_SERVER_UPDATED_AT_KEY);
      const bust = avatarUpdatedAtMs(syncedAt) || Date.now();
      setAvatarUri(withAvatarCacheBust(stored, bust));
    } catch {
      setAvatarUri(null);
    }
  }, []);

  const refreshAvatar = useCallback(async () => {
    if (uploadingRef.current) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        await applyLocalAvatarOnly();
        return;
      }

      const { uri } = await syncOwnProfileAvatarFromServer();
      setAvatarUri(uri);
    } catch {
      await applyLocalAvatarOnly();
    }
  }, [applyLocalAvatarOnly]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshAvatar();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAvatar]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        void refreshAvatar();
      } else {
        void applyLocalAvatarOnly();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshAvatar, applyLocalAvatarOnly]);

  const savePickedUri = useCallback(async (sourceUri) => {
    if (!sourceUri) return;
    const destFile = new File(Paths.document, PROFILE_AVATAR_LOCAL_FILENAME);
    let localPath;
    try {
      if (destFile.exists) {
        await destFile.delete();
      }
      const srcFile = new File(sourceUri);
      await srcFile.copy(destFile);
      localPath = destFile.uri;
      await AsyncStorage.setItem(AVATAR_STORAGE_KEY, localPath);
      setAvatarUri(withAvatarCacheBust(localPath, Date.now()));
    } catch {
      throw new Error('SAVE_FAILED');
    }

    setUploading(true);
    try {
      const { updatedAt } = await uploadProfileAvatarFromLocalUri(localPath);
      await markProfileAvatarSynced(updatedAt);
      setAvatarUri(withAvatarCacheBust(localPath, avatarUpdatedAtMs(updatedAt) || Date.now()));
    } catch (e) {
      if (e?.message === 'NOT_AUTHENTICATED') throw e;
      throw new Error('UPLOAD_FAILED');
    } finally {
      setUploading(false);
    }
  }, []);

  const removeAvatar = useCallback(async () => {
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
    setAvatarUri(null);
  }, []);

  const value = useMemo(
    () => ({
      avatarUri,
      loading,
      uploading,
      refreshAvatar,
      savePickedUri,
      removeAvatar }),
    [avatarUri, loading, uploading, refreshAvatar, savePickedUri, removeAvatar]
  );

  return <LocalAvatarContext.Provider value={value}>{children}</LocalAvatarContext.Provider>;
}

export function useLocalAvatar() {
  const ctx = useContext(LocalAvatarContext);
  if (!ctx) {
    throw new Error('useLocalAvatar must be used within LocalAvatarProvider');
  }
  return ctx;
}
