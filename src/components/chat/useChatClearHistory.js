import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import roomMessagesCache from '../../utils/roomMessagesCache';
import { buildHiddenForEveryone } from './buildHiddenForEveryone';

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
      const snapshot = [...messagesRef.current];
      if (snapshot.length === 0) return;
      try {
        let hiddenTarget = null;
        if (deleteForEveryone) {
          const { data: room, error: roomErr } = await supabase
            .from('rooms')
            .select('id, user1_id, user2_id')
            .eq('id', roomId)
            .maybeSingle();
          if (roomErr) throw roomErr;
          hiddenTarget = buildHiddenForEveryone(room, nickname, {
            peerName: otherPlayerName,
            messagesSnapshot: snapshot,
          });
        }
        const results = await Promise.all(
          snapshot.map((msg) => {
            const nextHidden = deleteForEveryone
              ? hiddenTarget
              : [...new Set([...(msg.hidden_for || []), nickname])];
            return supabase.from('messages').update({ hidden_for: nextHidden }).eq('id', msg.id);
          }),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
        setMessages([]);
        roomMessagesCache.set(roomId, []);
        if (deleteForEveryone) {
          chatSyncRef?.current?.clearThread?.();
          await unpinMessage?.();
        }
      } catch (e) {
        Alert.alert('Ошибка', e?.message || 'Не удалось очистить переписку');
      }
    },
    [roomId, nickname, otherPlayerName, messagesRef, setMessages, chatSyncRef, unpinMessage],
  );

  return { executeClearHistory };
}
