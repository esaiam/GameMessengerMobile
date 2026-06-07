import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearDecryptCache } from '../components/chat/messageDecrypt';
import { clearContactsListCache } from '../components/contacts/useContactsList';
import { clearStoredKeyPair } from '../utils/VaultKeyStore';
import { clearPublicKeyCache } from '../utils/VaultKeyServer';
import { readNicknameFromStorage } from './nicknameStorage';
import { supabase } from './supabase';

/** Удаление аккаунта на сервере и полная локальная очистка Vault. */
export async function deleteUserAccount() {
  const { error } = await supabase.rpc('delete_user_account');
  if (error) throw error;

  const nickname = await readNicknameFromStorage();

  if (nickname) {
    await clearDecryptCache(nickname);
    clearContactsListCache(nickname);
  } else {
    clearContactsListCache();
  }
  clearPublicKeyCache();

  await clearStoredKeyPair(nickname);
  await AsyncStorage.clear();
  await supabase.auth.signOut();
}
