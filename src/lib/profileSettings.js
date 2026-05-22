import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_DM_POLICY_KEY = '@vault_profile_dm_policy';
export const PROFILE_CHAT_WALLPAPER_KEY = '@vault_profile_chat_wallpaper';

/** @typedef {'everyone' | 'contacts' | 'nobody'} DmPolicy */

export const DM_POLICY_LABELS = {
  everyone: 'Все пользователи',
  contacts: 'Только контакты',
  nobody: 'Никто' };

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

export async function getDmPolicy() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_DM_POLICY_KEY);
    if (raw === 'contacts' || raw === 'nobody' || raw === 'everyone') return raw;
  } catch {
    /* ignore */
  }
  return 'everyone';
}

export async function setDmPolicy(policy) {
  await AsyncStorage.setItem(PROFILE_DM_POLICY_KEY, policy);
  notify();
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
