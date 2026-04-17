import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import Chat from '../components/Chat';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function ChatRoomScreen({ route, navigation }) {
  const { nickname, roomId, roomCode, title } = route.params || {};
  const insets = useSafeAreaInsets();

  const headerTitle = useMemo(() => title || 'Чат', [title]);
  const [contactOnline, setContactOnline] = useState(false);
  const [frostedHeaderH, setFrostedHeaderH] = useState(0);

  /** Без лишнего зазора: иначе под шапкой видна полоска фона ленты (bgApp + dim), темнее шапки */
  const listPaddingTop =
    frostedHeaderH > 0 ? frostedHeaderH : insets.top + 75;

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions?.({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions?.({ tabBarStyle: undefined });
    }, [navigation])
  );

  useEffect(() => {
    if (!roomId || !nickname) return;

    const ch = supabase.channel(`presence-room-${roomId}`, {
      config: { presence: { key: nickname } },
    });

    const recompute = () => {
      const st = ch.presenceState?.() || {};
      const online = new Set();
      Object.values(st).forEach((arr) => {
        (arr || []).forEach((p) => {
          if (p?.nickname) online.add(p.nickname);
        });
      });
      const other = headerTitle && headerTitle !== 'Чат' ? headerTitle : null;
      if (!other) {
        setContactOnline(false);
        return;
      }
      setContactOnline(online.has(other));
    };

    ch.on('presence', { event: 'sync' }, recompute);
    ch.on('presence', { event: 'join' }, recompute);
    ch.on('presence', { event: 'leave' }, recompute);

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track({ nickname, at: Date.now() });
        } catch {}
        recompute();
      }
    });

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [roomId, nickname, headerTitle]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: '#0F1A1A' }]}>
      <Chat
        roomId={roomId}
        roomCode={roomCode}
        nickname={nickname}
        compact={false}
        listPaddingTop={listPaddingTop}
        chatRoomHeader={{
          title: headerTitle,
          contactOnline,
          navigation,
        }}
        onTopOverlayHeight={setFrostedHeaderH}
      />
    </View>
  );
}
