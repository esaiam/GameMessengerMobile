import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@dialogs_v1_';

function key(nickname) {
  return `${PREFIX}${nickname}`;
}

/** Загрузить кэшированный список диалогов с диска. null если нет. */
export async function loadDialogsCache(nickname) {
  if (!nickname) return null;
  try {
    const raw = await AsyncStorage.getItem(key(nickname));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Сохранить список диалогов на диск. */
export async function saveDialogsCache(nickname, rows) {
  if (!nickname || !rows) return;
  try {
    await AsyncStorage.setItem(key(nickname), JSON.stringify(rows));
  } catch {
    // игнорируем ошибки записи кэша
  }
}

/** Удалить кэш для пользователя (при logout / смене никнейма). */
export async function clearDialogsCache(nickname) {
  if (!nickname) return;
  try {
    await AsyncStorage.removeItem(key(nickname));
  } catch {}
}
