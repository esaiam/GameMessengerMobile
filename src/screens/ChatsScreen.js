import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeBlurView from '../components/SafeBlurView';
import tw from 'twrnc';
import { ARIA_CONTACT, ARIA_ROOM_ID } from '../lib/aria';
import { TAB_BAR_LAYOUT, V } from '../theme';
import { Search, User } from '../icons/lucideIcons';
import { generateRoomCode } from '../utils/roomCode';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import TabBackground from '../components/TabBackground';
import { useChatsRoomsLoader } from '../hooks/useChatsRoomsLoader';
import { useChatsSearchReveal, CHATS_SEARCH_BOTTOM_SPACING_PX } from '../hooks/useChatsSearchReveal';
import ChatsListRow from '../components/chats/ChatsListRow';
import { clearPreviewCache } from './chats/chatsPreviewCache';
import { filterChatsRows, buildChatsListData } from './chats/chatsListData';
import { openTempDemoRoom } from './chats/openTempDemoRoom';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';

export default function ChatsScreen({ route, navigation }) {
  const nickname = useNicknameFromRoute(route);

  useEffect(() => {
    clearPreviewCache();
  }, [nickname]);

  const [q, setQ] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const headerLayout = useMessengerHeaderLayout();
  const [startingTemp, setStartingTemp] = useState(false);

  const { rows } = useChatsRoomsLoader(nickname);

  const {
    SEARCH_FIELD_H,
    searchPointerEvents,
    setSearchShown,
    panResponder,
    onListScroll,
    searchTranslateY,
    searchOpacity,
    iconOpacity,
    listTranslateY,
    setListViewportH,
    setListContentH,
  } = useChatsSearchReveal(q, searchFocused);

  const filtered = useMemo(() => filterChatsRows(rows, q), [q, rows]);

  const listData = useMemo(() => buildChatsListData(q, filtered), [q, filtered]);

  const openTempRoom = useCallback(async () => {
    if (!nickname || startingTemp) return;
    setStartingTemp(true);
    try {
      await openTempDemoRoom({ nickname, navigation, generateRoomCode });
    } finally {
      setStartingTemp(false);
    }
  }, [nickname, navigation, startingTemp]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <ChatsListRow
        item={item}
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
            <View style={{ marginBottom: CHATS_SEARCH_BOTTOM_SPACING_PX }}>
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
                paddingTop: SEARCH_FIELD_H + CHATS_SEARCH_BOTTOM_SPACING_PX,
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
