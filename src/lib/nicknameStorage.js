import AsyncStorage from '@react-native-async-storage/async-storage';

export const NICKNAME_STORAGE_KEY = '@vault_nickname';
export const LEGACY_NICKNAME_STORAGE_KEY = '@backgammon_nickname';

/**
 * Переносит handle из @backgammon_nickname → @vault_nickname (один раз при cold start).
 */
export async function runNicknameStorageMigration() {
  try {
    const current = await AsyncStorage.getItem(NICKNAME_STORAGE_KEY);
    if (current) {
      await AsyncStorage.removeItem(LEGACY_NICKNAME_STORAGE_KEY);
      return;
    }
    const legacy = await AsyncStorage.getItem(LEGACY_NICKNAME_STORAGE_KEY);
    if (!legacy) return;
    await AsyncStorage.setItem(NICKNAME_STORAGE_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_NICKNAME_STORAGE_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[Vault] nickname storage migration:', e?.message || e);
  }
}

export async function readNicknameFromStorage() {
  return AsyncStorage.getItem(NICKNAME_STORAGE_KEY);
}

/** @param {string} handle */
export async function writeNicknameToStorage(handle) {
  if (!handle) return;
  await AsyncStorage.setItem(NICKNAME_STORAGE_KEY, handle);
  await AsyncStorage.removeItem(LEGACY_NICKNAME_STORAGE_KEY);
}

export async function clearNicknameFromStorage() {
  await AsyncStorage.multiRemove([NICKNAME_STORAGE_KEY, LEGACY_NICKNAME_STORAGE_KEY]);
}
