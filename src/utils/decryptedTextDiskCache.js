import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@decrypt_txt_v1_';

function key(nickname) {
  return `${PREFIX}${nickname}`;
}

/** @returns {Promise<Record<string, { p: string, c: string }> | null>} */
export async function loadDecryptTextDisk(nickname) {
  if (!nickname) return null;
  try {
    const raw = await AsyncStorage.getItem(key(nickname));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** @param {Record<string, { p: string, c: string }>} entries */
export async function saveDecryptTextDisk(nickname, entries) {
  if (!nickname || !entries) return;
  try {
    await AsyncStorage.setItem(key(nickname), JSON.stringify(entries));
  } catch {
    /* игнорируем ошибки записи кэша */
  }
}

export async function clearDecryptTextDisk(nickname) {
  if (!nickname) return;
  try {
    await AsyncStorage.removeItem(key(nickname));
  } catch {}
}
