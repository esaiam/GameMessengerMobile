import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';

const AVATAR_STORAGE_KEY = '@vault_local_avatar_path';
const AVATAR_FILENAME = 'profile_avatar.jpg';

const LocalAvatarContext = createContext(null);

export function LocalAvatarProvider({ children }) {
  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAvatar = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      if (!stored) {
        setAvatarUri(null);
        return;
      }
      const file = new File(stored);
      if (!file.exists) {
        await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
        setAvatarUri(null);
        return;
      }
      setAvatarUri(stored);
    } catch {
      setAvatarUri(null);
    }
  }, []);

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

  const savePickedUri = useCallback(async (sourceUri) => {
    if (!sourceUri) return;
    const destFile = new File(Paths.document, AVATAR_FILENAME);
    try {
      if (destFile.exists) {
        destFile.delete();
      }
      const srcFile = new File(sourceUri);
      srcFile.copy(destFile);
      await AsyncStorage.setItem(AVATAR_STORAGE_KEY, destFile.uri);
      setAvatarUri(destFile.uri);
    } catch {
      throw new Error('SAVE_FAILED');
    }
  }, []);

  const removeAvatar = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      if (stored) {
        const file = new File(stored);
        if (file.exists) {
          file.delete();
        }
      }
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
    setAvatarUri(null);
  }, []);

  const value = useMemo(
    () => ({
      avatarUri,
      loading,
      refreshAvatar,
      savePickedUri,
      removeAvatar,
    }),
    [avatarUri, loading, refreshAvatar, savePickedUri, removeAvatar]
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
