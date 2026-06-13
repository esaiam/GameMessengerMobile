import { useCallback, useState } from 'react';
import { Alert, Share } from 'react-native';
import { blockPeer, unblockPeer } from '../../lib/blockedContacts';
import { hideChatRoom } from '../../lib/hiddenChats';
import { requestChatsListReload } from '../../lib/chatsListSync';
import { hideAllRoomMessagesForMe } from '../../lib/hideRoomMessagesForMe';
import { setContactAlias } from '../../lib/contactAliases';
import { supabase } from '../../lib/supabase';
import { clearContactsListCache } from '../../components/contacts/useContactsList';
import { loadDialogsCache, saveDialogsCache } from '../../utils/dialogsCache';
import { leaveContactProfileAfterDestructiveAction } from '../../lib/safeGoBack';

/**
 * Действия профиля контакта: block, delete, share, alias, busy.
 */
export function useContactProfileActions({
  nickname,
  peerName,
  roomId,
  navigation,
  blocked,
  setBlocked,
  setLocalDisplayName,
}) {
  const [busy, setBusy] = useState(false);

  const pruneDialogsCache = useCallback(async () => {
    if (!nickname || !roomId) return;
    const cached = await loadDialogsCache(nickname);
    if (!cached?.length) return;
    const next = cached.filter((r) => r.roomId !== roomId);
    await saveDialogsCache(nickname, next);
  }, [nickname, roomId]);

  const runDeleteContact = useCallback(async () => {
    if (!roomId || !nickname) {
      Alert.alert('Ошибка', 'Нет комнаты для удаления контакта.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('delete_contact_room', { room_id: roomId });
      if (error) throw error;
      await pruneDialogsCache();
      clearContactsListCache(nickname);
      leaveContactProfileAfterDestructiveAction(navigation);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось удалить контакт');
    } finally {
      setBusy(false);
    }
  }, [roomId, nickname, navigation, pruneDialogsCache]);

  const handleDeleteContact = useCallback(() => {
    Alert.alert(
      'Удалить контакт',
      'Контакт и переписка будут скрыты только у вас.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: runDeleteContact },
      ],
    );
  }, [runDeleteContact]);

  const handleShareContact = useCallback(async () => {
    if (!peerName) return;
    let message = `Контакт в Vault Messenger: ${peerName}`;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('handle')
        .eq('handle', peerName)
        .maybeSingle();
      const handle = typeof data?.handle === 'string' ? data.handle.trim() : '';
      if (handle) message = `Контакт в Vault Messenger: @${handle}`;
    } catch {
      /* share fallback */
    }
    try {
      await Share.share({ message });
    } catch {
      /* user dismissed */
    }
  }, [peerName]);

  const handleSaveContactAlias = useCallback(
    async (alias) => {
      if (!nickname || !peerName) return;
      setBusy(true);
      try {
        await setContactAlias(nickname, peerName, alias);
        setLocalDisplayName(alias);
      } catch (e) {
        Alert.alert('Ошибка', e?.message || 'Не удалось сохранить имя');
      } finally {
        setBusy(false);
      }
    },
    [nickname, peerName, setLocalDisplayName],
  );

  const runBlock = useCallback(async () => {
    if (!peerName || !nickname) return;
    setBusy(true);
    try {
      await blockPeer(nickname, peerName);
      setBlocked(true);
      if (roomId) {
        await hideAllRoomMessagesForMe({ roomId, nickname });
        await hideChatRoom(nickname, roomId);
        await pruneDialogsCache();
      }
      requestChatsListReload();
      Alert.alert('Готово', `${peerName} заблокирован.`);
      leaveContactProfileAfterDestructiveAction(navigation, { afterBlock: true });
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось заблокировать');
    } finally {
      setBusy(false);
    }
  }, [peerName, nickname, roomId, navigation, pruneDialogsCache, setBlocked]);

  const runUnblock = useCallback(async () => {
    if (!peerName || !nickname) return;
    setBusy(true);
    try {
      await unblockPeer(nickname, peerName);
      setBlocked(false);
      requestChatsListReload();
      Alert.alert('Готово', `${peerName} разблокирован.`);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось разблокировать');
    } finally {
      setBusy(false);
    }
  }, [peerName, nickname, setBlocked]);

  const handleBlock = useCallback(() => {
    if (blocked) {
      Alert.alert('Разблокировать', `Разблокировать ${peerName}?`, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Разблокировать', onPress: runUnblock },
      ]);
      return;
    }
    Alert.alert(
      'Заблокировать',
      `Заблокировать ${peerName}? Переписка скроется у вас.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Заблокировать', style: 'destructive', onPress: runBlock },
      ],
    );
  }, [blocked, peerName, runBlock, runUnblock]);

  return {
    busy,
    setBusy,
    handleDeleteContact,
    handleShareContact,
    handleSaveContactAlias,
    handleBlock,
  };
}
