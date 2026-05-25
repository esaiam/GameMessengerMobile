import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { normalizeUserPair } from '../../utils/roomIds';
import { generateRoomCode } from '../../utils/roomCode';
import { isBlocked } from '../../lib/blockedContacts';
import { navigateToBlockedContacts } from '../../lib/navigateToBlockedContacts';
import { syncDialogToChatsList } from '../../lib/chatsListSync';

/**
 * Открыть DM-комнату с контактом или создать rooms row.
 */
export async function openOrCreateContactRoom({ nickname, contactName, navigation }) {
  try {
    if (await isBlocked(nickname, contactName)) {
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

    const { user1Id, user2Id, roomId } = normalizeUserPair(nickname, contactName);

    const { data: existing, error: selErr } = await supabase
      .from('rooms')
      .select('id, code, user1_id, user2_id')
      .eq('id', roomId)
      .maybeSingle();

    if (selErr) {
      Alert.alert('Ошибка', selErr.message);
      return;
    }

    let room = existing;
    if (!room) {
      const code = generateRoomCode();
      const { data: created, error: insErr } = await supabase
        .from('rooms')
        .upsert(
          { id: roomId, code, user1_id: user1Id, user2_id: user2Id },
          { onConflict: 'id' },
        )
        .select('id, code, user1_id, user2_id')
        .single();
      if (insErr) {
        Alert.alert('Ошибка', insErr.message);
        return;
      }
      room = created;
    }

    await syncDialogToChatsList(nickname, {
      roomId: room.id,
      roomCode: room.code,
      contactName,
      last: null,
    });

    navigation?.navigate('Room', {
      roomId: room.id,
      nickname,
      peerName: contactName,
      playerNumber: room.user1_id === nickname ? 1 : 2,
    });
  } catch (e) {
    Alert.alert('Ошибка', e?.message || 'Не удалось открыть чат');
  }
}
