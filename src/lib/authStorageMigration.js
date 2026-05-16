import AsyncStorage from '@react-native-async-storage/async-storage';
import { VAULT_AUTH_KEY } from './vaultAuthStorageKey';

const LEGACY_AUTH_KEYS = [
  'sb-api-auth-token',
  'sb-nqssqplizwsukowggzxd-auth-token',
];

/**
 * Переносит JSON сессии из старых ключей @supabase/supabase-js в VAULT_AUTH_KEY до загрузки клиента.
 */
export async function runAuthStorageMigration() {
  try {
    const hasVault = await AsyncStorage.getItem(VAULT_AUTH_KEY);
    if (hasVault) {
      return;
    }
    for (const key of LEGACY_AUTH_KEYS) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      await AsyncStorage.setItem(VAULT_AUTH_KEY, raw);
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(`${key}-code-verifier`);
      return;
    }
  } catch (e) {
    console.warn('[Vault] auth storage migration:', e?.message || e);
  }
}
