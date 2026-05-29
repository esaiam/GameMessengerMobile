import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (ownerNickname, peerId) => `@vault_contact_alias_${ownerNickname}_${peerId}`;

/** Локальное отображаемое имя контакта (только на устройстве). */
export async function getContactAlias(ownerNickname, peerId) {
  if (!ownerNickname || !peerId) return '';
  try {
    const raw = await AsyncStorage.getItem(key(ownerNickname, peerId));
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

export async function setContactAlias(ownerNickname, peerId, alias) {
  if (!ownerNickname || !peerId) return;
  const trimmed = String(alias || '').trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(key(ownerNickname, peerId));
    return;
  }
  await AsyncStorage.setItem(key(ownerNickname, peerId), trimmed);
}
