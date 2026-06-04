import { useCallback } from 'react';
import { Alert } from 'react-native';
import { isBlocked } from '../../lib/blockedContacts';
import { navigateToBlockedContacts } from '../../lib/navigateToBlockedContacts';

export function useChatsNavigateToChat({
  nickname,
  navigation,
  isSplit,
  setDetailParams,
  openAriaPanel,
}) {
  return useCallback(
    async (item) => {
      if (item.isAria) {
        openAriaPanel?.();
        return;
      }
      if (await isBlocked(nickname, item.contactName)) {
        Alert.alert(
          'Контакт заблокирован',
          'Разблокируйте в Профиль → Заблокированные контакты.',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Заблокированные',
              onPress: () => navigateToBlockedContacts(navigation),
            },
          ],
        );
        return;
      }
      const params = {
        nickname,
        roomId: item.roomId,
        roomCode: item.roomCode,
        peerName: item.contactName,
        title: item.contactName,
      };
      if (isSplit) {
        setDetailParams({ type: 'Room', params });
      } else {
        navigation.navigate('Room', params);
      }
    },
    [nickname, navigation, isSplit, setDetailParams, openAriaPanel],
  );
}
