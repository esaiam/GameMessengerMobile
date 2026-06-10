import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { vaultClearThreadForEveryone } from '../../lib/vaultHideRoomForEveryone';
import { chatMutationErrorMessage } from './chatMutationErrorMessage';
import { broadcastThreadClear } from '../../lib/chatThreadBroadcast';
import { clearRoomReadCursor } from '../../lib/chatReadCursor';

export default function useChatClearHistory({
  roomId,
  nickname,
  otherPlayerName,
  messagesRef,
  setMessages,
  chatSyncRef,
  unpinMessage,
}) {
  const executeClearHistory = useCallback(
    async (deleteForEveryone) => {
      if (!roomId) return;
      try {
        if (deleteForEveryone) {
          await vaultClearThreadForEveryone(roomId);
          await clearRoomReadCursor(nickname, roomId);
          setMessages([]);
          roomMessagesCache.set(roomId, []);
          chatSyncRef?.current?.clearThread?.();
          void broadcastThreadClear(roomId);
          await unpinMessage?.();
          return;
        }
        const snapshot = [...messagesRef.current];
        if (snapshot.length === 0) return;
        const results = await Promise.all(
          snapshot.map((msg) => {
            const nextHidden = [...new Set([...(msg.hidden_for || []), nickname])];
            return supabase.from('messages').update({ hidden_for: nextHidden }).eq('id', msg.id);
          }),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
        setMessages([]);
        roomMessagesCache.set(roomId, []);
      } catch (e) {
        Alert.alert(
          'Ошибка',
          chatMutationErrorMessage(e, e?.message || 'Не удалось очистить переписку'),
        );
      }
    },
    [roomId, nickname, messagesRef, setMessages, chatSyncRef, unpinMessage],
  );

  return { executeClearHistory };
}
