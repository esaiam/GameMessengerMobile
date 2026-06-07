import { clearDecryptCache } from '../components/chat/messageDecrypt';
import { clearContactsListCache } from '../components/contacts/useContactsList';
import { clearStoredKeyPair } from '../utils/VaultKeyStore';
import { clearPublicKeyCache } from '../utils/VaultKeyServer';
import { clearReadCursors } from './chatReadCursor';
import { clearNicknameFromStorage, readNicknameFromStorage } from './nicknameStorage';

/**
 * Локальные секреты сессии: decrypt-кэш, nickname, in-memory pubkey cache.
 * E2E-ключи хранятся per-@handle в SecureStore — не удаляем при logout,
 * чтобы смена аккаунта на устройстве не подмешивала чужую пару.
 *
 * @param {{ wipeKeys?: boolean }} [opts]
 */
export async function clearVaultLocalSession(opts = {}) {
  const nickname = await readNicknameFromStorage();
  if (nickname) {
    await clearDecryptCache(nickname);
    clearContactsListCache(nickname);
    await clearReadCursors(nickname);
    if (opts.wipeKeys) {
      await clearStoredKeyPair(nickname);
    }
  } else {
    clearContactsListCache();
  }
  clearPublicKeyCache();
  await clearNicknameFromStorage();
}
