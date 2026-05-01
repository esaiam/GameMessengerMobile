import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  InteractionManager,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeBlurView from '../components/SafeBlurView';
import { AriaGradientAvatar } from '../components/chat/AriaChatUi';
import tw from 'twrnc';
import { supabase } from '../lib/supabase';
import { ARIA_CONTACT, ARIA_ROOM_ID } from '../lib/aria';
import { TAB_BAR_INNER_ROW_H, TAB_BAR_LAYOUT, V } from '../theme';
import { deriveKey, decrypt, looksLikeEncryptedPayload } from '../utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, User } from '../icons/lucideIcons';
import { normalizeUserPair } from '../utils/roomIds';
import TabBackground from '../components/TabBackground';
import roomMessagesCache from '../utils/roomMessagesCache';
import { useFocusEffect } from '@react-navigation/native';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';

const NICKNAME_KEY = '@backgammon_nickname';

/** Строка Aria в списке чатов (не из `rooms`). */
const ARIA_CHAT_LIST_ITEM = {
  isAria: true,
  roomId: ARIA_ROOM_ID,
  roomCode: null,
  contactName: ARIA_CONTACT.display_name,
  last: {
    id: 'aria-chats-preview',
    text: 'Привет. Я здесь.',
    message_type: 'text',
    created_at: null,
  },
};

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

/** Кэш превью: ключ — msgId (текст сообщения неизменен после создания). */
const _previewCache = new Map();

function decryptPreview(text, roomCode) {
  if (!text) return '';
  if (text.startsWith('VM2:')) return '[зашифровано]';
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
  const cacheKey = msg.id;
  if (_previewCache.has(cacheKey)) return _previewCache.get(cacheKey);
  const result = decryptPreview(msg.text || '', roomCode) || 'Сообщение';
  _previewCache.set(cacheKey, result);
  return result;
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

const ChatRow = React.memo(
  function ChatRow({ item, nickname, onPress, isFirst }) {
    const ts = item.last?.created_at || null;
    const preview = item.isAria ? 'Привет. Я здесь.' : messagePreview(item.last, item.roomCode);
    const [layout, setLayout] = useState({ w: 0, h: 0 });
    const [ripple, setRipple] = useState({ visible: false, x: 0, y: 0 });
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const rippleAnimRef = useRef(null);
    const navigateTimerRef = useRef(null);

    const maxD =
      layout.w > 0 && layout.h > 0
        ? Math.ceil(Math.sqrt(layout.w * layout.w + layout.h * layout.h) * 2)
        : 0;

    useLayoutEffect(() => {
      if (!ripple.visible || maxD <= 0) return undefined;
      rippleAnimRef.current?.stop?.();
      const anim = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]);
      rippleAnimRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) {
          scaleAnim.setValue(0);
          opacityAnim.setValue(0);
          setRipple((r) => ({ ...r, visible: false }));
        }
      });
      return () => anim.stop();
    }, [ripple.visible, ripple.x, ripple.y, maxD, scaleAnim, opacityAnim]);

    const onPressIn = useCallback(
      (e) => {
        const { locationX, locationY } = e.nativeEvent;
        rippleAnimRef.current?.stop?.();
        scaleAnim.setValue(0);
        opacityAnim.setValue(1);
        setRipple({ visible: true, x: locationX, y: locationY });
      },
      [scaleAnim, opacityAnim]
    );

    const handlePress = useCallback(() => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null;
        onPress();
      }, 0);
    }, [onPress]);

    useEffect(
      () => () => {
        if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
      },
      []
    );

    return (
      <View
        style={[
          isFirst ? tw`pt-0 pb-3` : tw`py-3`,
          { borderBottomWidth: 0.5, borderBottomColor: V.border, overflow: 'hidden' },
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
        }}
      >
        <Pressable onPressIn={onPressIn} onPress={handlePress} android_ripple={null}>
          {ripple.visible && maxD > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: ripple.x - maxD / 2,
                top: ripple.y - maxD / 2,
                width: maxD,
                height: maxD,
                borderRadius: maxD / 2,
                backgroundColor: 'rgba(90, 158, 154, 0.2)',
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              }}
            />
          ) : null}
          <View style={tw`flex-row items-center`}>
            {item.isAria ? <AriaGradientAvatar size={48} /> : <Avatar name={item.contactName} />}
            <View style={tw`flex-1 ml-3`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center flex-1 min-w-0 mr-2`}>
                  <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
                    {item.contactName}
                  </Text>
                  {item.isAria ? (
                    <Text
                      style={[tw`text-[10px] font-medium ml-1.5`, { color: V.accentSage, opacity: 0.8 }]}
                    >
                      AI
                    </Text>
                  ) : null}
                </View>
                <Text style={[tw`text-[10px]`, { color: V.textMuted }]}>{formatTime(ts)}</Text>
              </View>
              <Text style={[tw`text-[12px] mt-0.5`, { color: V.textSecondary }]} numberOfLines={1}>
                {preview}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  },
  (prev, next) =>
    prev.item.isAria === next.item.isAria &&
    prev.item.roomId === next.item.roomId &&
    prev.item.last?.id === next.item.last?.id &&
    prev.item.last?.created_at === next.item.last?.created_at &&
    prev.isFirst === next.isFirst
);

export default function ChatsScreen({ route, navigation }) {
  const [nickname, setNickname] = useState(route.params?.nickname || '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const headerLayout = useMessengerHeaderLayout();
  const searchInputRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchPointerEvents, setSearchPointerEvents] = useState('auto');

  const rowsCacheRef = useRef({ nickname: null, rows: [] });
  const [startingTemp, setStartingTemp] = useState(false);

  const SEARCH_HIDE_THRESHOLD_PX = 12;
  const SEARCH_HIDE_GAP_PX = 8;
  const SEARCH_BOTTOM_SPACING_PX = 16;
  const SEARCH_FIELD_H = TAB_BAR_INNER_ROW_H - 2;
  const searchReveal = useRef(new Animated.Value(1)).current; // 1 = shown, 0 = hidden
  const lastScrollYRef = useRef(0);
  const searchShownRef = useRef(true);
  const accumDyRef = useRef(0);
  const lastDirRef = useRef(0); // -1 up, 0 idle, +1 down
  const [listViewportH, setListViewportH] = useState(0);
  const [listContentH, setListContentH] = useState(0);
  const isScrollable = listContentH > listViewportH + 1;
  const isScrollableRef = useRef(isScrollable);
  const gestureLastDyRef = useRef(0);

  const setSearchShown = useCallback(
    (shown) => {
      if (!shown) {
        // Telegram-like: when query exists or input is focused, search must stay visible.
        if (q.trim().length > 0 || searchFocused) return;
      }
      if (searchShownRef.current === shown) return;
      searchShownRef.current = shown;
      setSearchPointerEvents(shown ? 'auto' : 'none');
      Animated.timing(searchReveal, {
        toValue: shown ? 1 : 0,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [q, searchFocused, searchReveal]
  );

  useEffect(() => {
    // Keep search visible while user is interacting with it.
    if (q.trim().length > 0 || searchFocused) setSearchShown(true);
  }, [q, searchFocused, setSearchShown]);

  useEffect(() => {
    isScrollableRef.current = isScrollable;
  }, [isScrollable]);

  const onListScroll = useCallback(
    (e) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const last = lastScrollYRef.current;
      const dy = y - last;
      const dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      lastScrollYRef.current = y;

      if (y <= 0) {
        setSearchShown(true);
        accumDyRef.current = 0;
        lastDirRef.current = 0;
        return;
      }

      if (dir !== 0 && dir !== lastDirRef.current) {
        accumDyRef.current = 0;
        lastDirRef.current = dir;
      }

      if (dir === -1) {
        // Telegram-like: slightest upward scroll starts revealing immediately.
        if (dy < -1) setSearchShown(true);
        return;
      }

      if (dir === 1) {
        accumDyRef.current += dy;
        if (accumDyRef.current > SEARCH_HIDE_THRESHOLD_PX) {
          setSearchShown(false);
          accumDyRef.current = 0;
        }
      }
    },
    [setSearchShown]
  );

  const onVirtualScrollDy = useCallback(
    (dy) => {
      const dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;

      if (dir !== 0 && dir !== lastDirRef.current) {
        accumDyRef.current = 0;
        lastDirRef.current = dir;
      }

      if (dir === -1) {
        if (dy < -1) setSearchShown(true);
        return;
      }

      if (dir === 1) {
        accumDyRef.current += dy;
        if (accumDyRef.current > SEARCH_HIDE_THRESHOLD_PX) {
          setSearchShown(false);
          accumDyRef.current = 0;
        }
      }
    },
    [setSearchShown]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (isScrollableRef.current) return false;
          const { dx, dy } = gestureState;
          const isVertical = Math.abs(dy) > 2 && Math.abs(dy) > Math.abs(dx);
          if (!isVertical) return false;

          // Avoid breaking pull-to-refresh when search is already visible.
          // Finger up (dy < 0) == virtual scroll down => hide search.
          if (dy < 0) return true;
          // Finger down (dy > 0) should be captured only to reveal hidden search.
          return !searchShownRef.current;
        },
        onPanResponderGrant: () => {
          gestureLastDyRef.current = 0;
          accumDyRef.current = 0;
          lastDirRef.current = 0;
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (isScrollableRef.current) return;
          const currentFingerDy = gestureState.dy || 0;
          const deltaFingerDy = currentFingerDy - gestureLastDyRef.current;
          gestureLastDyRef.current = currentFingerDy;

          // Convert finger movement to "virtual scroll dy":
          // finger up (negative) == scroll down (positive y) => hide
          const virtualDy = -deltaFingerDy;
          onVirtualScrollDy(virtualDy);
        },
        onPanResponderRelease: () => {
          gestureLastDyRef.current = 0;
          accumDyRef.current = 0;
          lastDirRef.current = 0;
        },
        onPanResponderTerminate: () => {
          gestureLastDyRef.current = 0;
          accumDyRef.current = 0;
          lastDirRef.current = 0;
        },
      }),
    [onVirtualScrollDy]
  );

  const searchTranslateY = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [-(SEARCH_FIELD_H + SEARCH_HIDE_GAP_PX), 0],
      }),
    [searchReveal]
  );

  const searchOpacity = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }),
    [searchReveal]
  );

  const iconOpacity = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [searchReveal]
  );

  const listTranslateY = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [-(SEARCH_FIELD_H + SEARCH_BOTTOM_SPACING_PX), 0],
      }),
    [searchReveal]
  );

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

    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, code, user1_id, user2_id')
      .or(`user1_id.eq.${nickname},user2_id.eq.${nickname}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (roomsError) {
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить чаты. Проверь подключение.',
        [{ text: 'OK' }]
      );
      return;
    }

    const roomList = rooms || [];
    const roomIds = roomList.map((r) => r.id);

    let lastByRoom = {};
    if (roomIds.length > 0) {
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, room_id, text, message_type, created_at, player_name')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })
        .limit(200);

      if (messagesError) {
        Alert.alert(
          'Ошибка загрузки',
          'Не удалось загрузить чаты. Проверь подключение.',
          [{ text: 'OK' }]
        );
        return;
      }

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

    next.forEach(({ roomId, last }) => {
      if (!last) return;
      if (roomMessagesCache.has(roomId)) return;
      roomMessagesCache.set(roomId, [last]);
    });

    rowsCacheRef.current = { nickname, rows: next };
    setRows(next);
  }, [nickname]);

  useFocusEffect(
    useCallback(() => {
      const cached = rowsCacheRef.current;
      if (cached.rows.length > 0 && cached.nickname === nickname) {
        setRows(cached.rows);
      }
      const task = InteractionManager.runAfterInteractions(() => {
        load();
      });
      const interval = setInterval(() => load(), 12000);
      return () => {
        task.cancel();
        clearInterval(interval);
      };
    }, [load, nickname])
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.contactName || '').toLowerCase().includes(s));
  }, [q, rows]);

  const listData = useMemo(() => {
    const s = q.trim().toLowerCase();
    const ariaNeedle = `${ARIA_CONTACT.display_name} ${ARIA_CONTACT.handle}`.toLowerCase();
    const includeAria =
      !s ||
      ariaNeedle.includes(s) ||
      s.includes('aria') ||
      s.includes('ария') ||
      s === 'ai';
    if (!includeAria) return filtered;
    return [ARIA_CHAT_LIST_ITEM, ...filtered];
  }, [q, filtered]);

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

        navigation.navigate('Room', {
          roomId: room.id,
          nickname,
          peerName: demoId,
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

        navigation.navigate('Room', {
          roomId: createdLegacy.id,
          nickname,
          peerName: demoId,
          playerNumber: createdLegacy.player1_name === nickname ? 1 : 2,
          selfPlay: true,
        });
      }
    } finally {
      setStartingTemp(false);
    }
  }, [nickname, navigation, startingTemp]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <ChatRow
        item={item}
        nickname={nickname}
        isFirst={index === 0}
        onPress={() => {
          if (item.isAria) {
            navigation.navigate('ChatRoom', {
              roomId: ARIA_ROOM_ID,
              isAriaChat: true,
              contact: ARIA_CONTACT,
              nickname,
              title: ARIA_CONTACT.display_name,
              peerName: ARIA_CONTACT.display_name,
            });
            return;
          }
          navigation.navigate('Room', {
            nickname,
            roomId: item.roomId,
            roomCode: item.roomCode,
            peerName: item.contactName,
            title: item.contactName,
          });
        }}
      />
    ),
    [nickname, navigation]
  );

  return (
    <TabBackground>
      <View style={[tw`flex-1`, { backgroundColor: 'transparent' }]}>
        <View
          style={[
            headerLayout.containerStyle,
            {
              backgroundColor: 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
            Vault
          </Text>
          <Animated.View style={{ opacity: iconOpacity }}>
            <TouchableOpacity
              onPress={() => {
                setSearchShown(true);
                requestAnimationFrame(() => {
                  searchInputRef.current?.focus?.();
                });
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Поиск"
            >
              <Search size={18} strokeWidth={1.5} color={V.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={[tw`flex-1`]}>
          <Animated.View
            pointerEvents={searchPointerEvents}
            style={[
              {
                position: 'absolute',
                left: MESSENGER_HEADER_PADDING_HORIZONTAL,
                right: MESSENGER_HEADER_PADDING_HORIZONTAL,
                top: 0,
                zIndex: 2,
                elevation: 2,
                opacity: searchOpacity,
                transform: [{ translateY: searchTranslateY }],
              },
            ]}
          >
            <View style={{ marginBottom: SEARCH_BOTTOM_SPACING_PX }}>
              <SafeBlurView
                  intensity={20}
                  tint="dark"
                  blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
                  style={[
                    tw`flex-row items-center`,
                    {
                      minHeight: SEARCH_FIELD_H,
                      borderRadius: SEARCH_FIELD_H / 2,
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
                  ref={searchInputRef}
                  style={[
                    tw`flex-1 text-[16px]`,
                    {
                      color: V.textPrimary,
                      paddingVertical: 0,
                      height: SEARCH_FIELD_H,
                    },
                  ]}
                  placeholder="Поиск..."
                  placeholderTextColor={V.textGhost}
                  value={q}
                  onChangeText={setQ}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
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
          </Animated.View>

          <Animated.View
            {...panResponder.panHandlers}
              style={[
              tw`flex-1`,
              {
                transform: [{ translateY: listTranslateY }],
                paddingHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL,
              },
            ]}
            onLayout={(e) => setListViewportH(e.nativeEvent.layout.height)}
          >
            <FlatList
              data={listData}
              keyExtractor={(i) => (i.isAria ? ARIA_ROOM_ID : i.roomId)}
              renderItem={renderItem}
              onScroll={onListScroll}
              scrollEventThrottle={16}
              onContentSizeChange={(_w, h) => setListContentH(h)}
              contentContainerStyle={{
                paddingTop: SEARCH_FIELD_H + SEARCH_BOTTOM_SPACING_PX,
              }}
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
          </Animated.View>
        </View>
      </View>
    </TabBackground>
  );
}

