import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import roomMessagesCache from '../utils/roomMessagesCache';
import { filterExpiredMessages, filterHiddenForUser } from '../components/chat/messageFilters';

const MEDIA_TYPES = new Set(['image', 'video']);
const FETCH_LIMIT = 120;

function pickRoomMedia(messages, nickname) {
  if (!messages?.length) return [];
  const visible = filterHiddenForUser(filterExpiredMessages(messages), nickname);
  return visible
    .filter((m) => MEDIA_TYPES.has(m.message_type) && m.media_url)
    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
}

/**
 * Фото и видео из комнаты чата (кэш ленты или выборка из messages).
 */
export function useContactProfileRoomMedia(roomId, nickname) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!roomId || !nickname) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cached = roomMessagesCache.get(roomId);
    const cachedMedia = cached?.length ? pickRoomMedia(cached, nickname) : [];

    if (cachedMedia.length > 0) {
      setItems(cachedMedia);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, message_type, media_url, created_at, expires_at, hidden_for')
        .eq('room_id', roomId)
        .in('message_type', ['image', 'video'])
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT);

      if (error) throw error;
      const chronological = data?.length ? [...data].reverse() : [];
      setItems(pickRoomMedia(chronological, nickname));
    } catch {
      if (!cachedMedia.length) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [roomId, nickname]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { items, loading, reload: load };
}
