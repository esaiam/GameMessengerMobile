import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_CHAT_WALLPAPER_KEY = '@vault_profile_chat_wallpaper';

const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeProfileSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getChatWallpaperEnabled() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CHAT_WALLPAPER_KEY);
    if (raw === '0') return false;
  } catch {
    /* ignore */
  }
  return true;
}

export async function setChatWallpaperEnabled(enabled) {
  await AsyncStorage.setItem(PROFILE_CHAT_WALLPAPER_KEY, enabled ? '1' : '0');
  notify();
}
