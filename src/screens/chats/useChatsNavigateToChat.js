import { useCallback } from 'react';
import { Alert } from 'react-native';
import { ARIA_CONTACT, ARIA_ROOM_ID } from '../../lib/aria';
import { isBlocked } from '../../lib/blockedContacts';
import { navigateToBlockedContacts } from '../../lib/navigateToBlockedContacts';

export function useChatsNavigateToChat({
  nickname,
  navigation,
  isSplit,
  setDetailParams,
}) {
  return useCallback(
    async (item) => {
      if (item.isAria) {
        const params = {
          roomId: ARIA_ROOM_ID,
          isAriaChat: true,
          contact: ARIA_CONTACT,
          nickname,
          title: ARIA_CONTACT.display_name,
          peerName: ARIA_CONTACT.display_name,
        };
        if (isSplit) {
          setDetailParams({ type: 'ChatRoom', params });
        } else {
          navigation.navigate('ChatRoom', params);
        }
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
    [nickname, navigation, isSplit, setDetailParams],
  );
}
