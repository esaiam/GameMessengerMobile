import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, RefreshControl, Platform, StyleSheet } from 'react-native';
import SafeBlurView from '../components/SafeBlurView';
import tw from 'twrnc';
import { supabase } from '../lib/supabase';
import { TAB_BAR_INNER_ROW_H, TAB_BAR_LAYOUT, V } from '../theme';
import { deriveKey, decrypt, looksLikeEncryptedPayload } from '../utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../icons/lucideIcons';
import { normalizeUserPair } from '../utils/roomIds';
import TabBackground from '../components/TabBackground';

const NICKNAME_KEY = '@backgammon_nickname';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getInitials(name) {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '?';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function decryptPreview(text, roomCode) {
  if (!text) return '';
  if (!roomCode) return text;
  const key = deriveKey(roomCode);
  const plain = decrypt(text, key);
  if (plain != null && plain !== '') return plain;
  if (looksLikeEncryptedPayload(text)) return 'Не удалось расшифровать';
  return text;
}

function messagePreview(msg, roomCode) {
  if (!msg) return 'Нет сообщений';
  if (msg.message_type && msg.message_type !== 'text') {
    if (msg.message_type === 'image') return 'Фото';
    if (msg.message_type === 'audio') return 'Голосовое';
    if (msg.message_type === 'location') return 'Геолокация';
    return 'Сообщение';
  }
  return decryptPreview(msg.text || '', roomCode) || 'Сообщение';
}

function Avatar({ name }) {
  return (
    <View
      style={[
        tw`w-12 h-12 rounded-full items-center justify-center`,
        { backgroundColor: V.outBubbleBg },
      ]}
    >
      <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

export default function ChatsScreen({ route, navigation }) {
  const [nickname, setNickname] = useState(route.params?.nickname || '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [startingTemp, setStartingTemp] = useState(false);

  useEffect(() => {
    if (route.params?.nickname && route.params.nickname !== nickname) {
      setNickname(route.params.nickname);
      return;
    }
    if (!route.params?.nickname && !nickname) {
      AsyncStorage.getItem(NICKNAME_KEY).then((stored) => {
        if (stored) setNickname(stored);
      });
    }
  }, [route.params?.nickname, nickname]);

  const load = useCallback(async () => {
    if (!nickname) return;

    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, code, user1_id, user2_id')
      .or(`user1_id.eq.${nickname},user2_id.eq.${nickname}`)
      .order('created_at', { ascending: false })
      .limit(50);

    const roomList = rooms || [];
    const roomIds = roomList.map((r) => r.id);

    let lastByRoom = {};
    if (roomIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, room_id, text, message_type, created_at, player_name')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(200);

      (messages || []).forEach((m) => {
        if (!lastByRoom[m.room_id]) lastByRoom[m.room_id] = m;
      });
    }

    const next = roomList.map((r) => {
      const other =
        r.user1_id === nickname ? r.user2_id || '...' : r.user1_id || '...';
      const last = lastByRoom[r.id] || null;
      return {
        roomId: r.id,
        roomCode: r.code,
        contactName: other,
        last,
      };
    });

    setRows(next);
  }, [nickname]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.contactName || '').toLowerCase().includes(s));
  }, [q, rows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openTempRoom = useCallback(async () => {
    if (!nickname || startingTemp) return;
    setStartingTemp(true);
    try {
      const demoId = 'demo';
      const { user1Id, user2Id, roomId } = normalizeUserPair(nickname, demoId);
      const code = generateRoomCode();

      // Prefer modern schema; fallback to legacy if DB isn't migrated yet.
      try {
        const { data: existing, error: selErr } = await supabase
          .from('rooms')
          .select('id, code, user1_id, user2_id')
          .eq('id', roomId)
          .maybeSingle();
        if (selErr) throw new Error(selErr.message);

        let room = existing;
        if (!room) {
          const { data: created, error: insErr } = await supabase
            .from('rooms')
            .upsert({ id: roomId, code, user1_id: user1Id, user2_id: user2Id }, { onConflict: 'id' })
            .select('id, code, user1_id, user2_id')
            .single();
          if (insErr) throw new Error(insErr.message);
          room = created;
        }

        navigation.navigate('Game', {
          roomId: room.id,
          nickname,
          playerNumber: room.user1_id === nickname ? 1 : 2,
          selfPlay: true,
        });
      } catch (modernErr) {
        const { data: createdLegacy, error: legacyErr } = await supabase
          .from('rooms')
          .insert({
            code,
            player1_name: nickname,
            player2_name: demoId,
            status: 'playing',
          })
          .select('id, code, player1_name, player2_name')
          .single();
        if (legacyErr) throw new Error(legacyErr.message || modernErr?.message);

        navigation.navigate('Game', {
          roomId: createdLegacy.id,
          nickname,
          playerNumber: createdLegacy.player1_name === nickname ? 1 : 2,
          selfPlay: true,
        });
      }
    } finally {
      setStartingTemp(false);
    }
  }, [nickname, navigation, startingTemp]);

  const renderItem = ({ item }) => {
    const ts = item.last?.created_at || null;
    const preview = messagePreview(item.last, item.roomCode);

    return (
      <TouchableOpacity
        style={[
          tw`py-3`,
          { borderBottomWidth: 0.5, borderBottomColor: V.border },
        ]}
        onPress={() =>
          navigation.navigate('Game', {
            nickname,
            roomId: item.roomId,
            roomCode: item.roomCode,
            title: item.contactName,
          })
        }
      >
        <View style={tw`flex-row items-center`}>
          <Avatar name={item.contactName} />
          <View style={tw`flex-1 ml-3`}>
            <View style={tw`flex-row items-center justify-between`}>
              <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
                {item.contactName}
              </Text>
              <Text style={[tw`text-[10px]`, { color: V.textMuted }]}>{formatTime(ts)}</Text>
            </View>
            <Text style={[tw`text-[12px] mt-0.5`, { color: V.textSecondary }]} numberOfLines={1}>
              {preview}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <TabBackground>
      <View style={[tw`flex-1 pt-12 px-4`, { backgroundColor: 'transparent' }]}>
        <View style={tw`mb-3`}>
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]}>Чаты</Text>
        </View>

        <View style={tw`mb-3`}>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: TAB_BAR_LAYOUT.borderRadius,
                borderWidth: 2,
                borderColor: V.sageBorder,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: TAB_BAR_LAYOUT.borderRadius,
                borderWidth: 1,
                borderColor: V.sageFocus,
              },
            ]}
          />
          <SafeBlurView
            intensity={20}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
            style={[
              tw`flex-row items-center`,
              {
                height: TAB_BAR_INNER_ROW_H,
                borderRadius: TAB_BAR_LAYOUT.borderRadius,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
                paddingHorizontal: TAB_BAR_LAYOUT.rowPaddingH,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: V.sageSubtle,
                  opacity: 1,
                },
              ]}
            />
          <TextInput
            style={[
              tw`flex-1 text-[13px]`,
              {
                color: V.textPrimary,
                paddingVertical: 0,
                height: TAB_BAR_INNER_ROW_H,
              },
            ]}
            placeholder="Поиск..."
            placeholderTextColor={V.textGhost}
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!q && (
            <TouchableOpacity
              onPress={() => setQ('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={tw`ml-2`}
              accessibilityRole="button"
              accessibilityLabel="Очистить поиск"
            >
              <Text style={[tw`text-[18px]`, { color: V.textPrimary, lineHeight: 18 }]}>×</Text>
            </TouchableOpacity>
          )}
          </SafeBlurView>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.roomId}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={V.accentSage} />
          }
          ListEmptyComponent={
            <View style={tw`py-10`}>
              {q.trim().length > 0 ? (
                <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
                  Контакты не найдены
                </Text>
              ) : (
                <>
                  <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
                    Пока нет чатов.
                  </Text>
                  <TouchableOpacity
                    onPress={openTempRoom}
                    style={[
                      tw`self-center mt-4 rounded-[10px] px-4 py-3 flex-row items-center`,
                      { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.accentSage },
                    ]}
                    disabled={!nickname || startingTemp}
                  >
                    <User size={16} color={V.accentSage} strokeWidth={1.6} style={tw`mr-2`} />
                    <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>
                      {startingTemp ? 'Открываю...' : 'Начать чат'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </TabBackground>
  );
}

