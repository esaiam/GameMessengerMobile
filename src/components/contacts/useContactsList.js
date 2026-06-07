import { useState, useEffect, useCallback } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { getBlockedPeers } from '../../lib/blockedContacts';
import { getHiddenChatRoomIds } from '../../lib/hiddenChats';

/** In-memory cache: PagerView монтирует один stack — без кэша каждый визит = новый fetch. */
const contactsByNickname = new Map();

export function clearContactsListCache(nickname) {
  if (nickname) contactsByNickname.delete(nickname);
  else contactsByNickname.clear();
}

export default function useContactsList(nickname) {
  const [contacts, setContacts] = useState(() =>
    nickname ? contactsByNickname.get(nickname) ?? [] : [],
  );

  const fetchContacts = useCallback(async () => {
    if (!nickname) return;

    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${nickname},user2_id.eq.${nickname}`);

    if (!rooms) return;

    const [blocked, hiddenRooms] = await Promise.all([
      getBlockedPeers(nickname),
      getHiddenChatRoomIds(nickname),
    ]);

    const names = new Set();
    rooms.forEach((r) => {
      if (r.id && hiddenRooms.has(r.id)) return;
      if (r.user1_id && r.user1_id !== nickname && !blocked.has(r.user1_id)) {
        names.add(r.user1_id);
      }
      if (r.user2_id && r.user2_id !== nickname && !blocked.has(r.user2_id)) {
        names.add(r.user2_id);
      }
    });
    const sorted = [...names].sort();
    contactsByNickname.set(nickname, sorted);
    setContacts(sorted);
  }, [nickname]);

  useEffect(() => {
    if (!nickname) return;
    if (contactsByNickname.has(nickname)) {
      setContacts(contactsByNickname.get(nickname));
      return;
    }
    fetchContacts();
  }, [nickname, fetchContacts]);

  useFocusEffect(
    useCallback(() => {
      if (!nickname) return undefined;
      const cached = contactsByNickname.get(nickname);
      if (cached?.length) setContacts(cached);
      const task = InteractionManager.runAfterInteractions(() => {
        fetchContacts();
      });
      return () => task.cancel?.();
    }, [nickname, fetchContacts]),
  );

  const filterContacts = useCallback(
    (searchQ) => {
      if (searchQ.trimStart().startsWith('@')) return [];
      const s = searchQ.trim().toLowerCase();
      if (!s) return contacts;
      return contacts.filter((name) => (name || '').toLowerCase().includes(s));
    },
    [contacts],
  );

  return { contacts, fetchContacts, filterContacts };
}
