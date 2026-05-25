import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import SafeBlurView from '../components/SafeBlurView';
import tw from 'twrnc';
import { ARIA_CONTACT, ARIA_ROOM_ID } from '../lib/aria';
import {
  SEARCH_CHATS_CAPSULE_RADIUS,
  SEARCH_FIELD_LAYOUT,
  V,
} from '../theme';
import { useAndroidTabOverscroll } from '../hooks/useAndroidTabOverscroll';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';
import { Search, Trash2 } from '../icons/lucideIcons';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { useChatsSelection } from '../hooks/useChatsSelection';
import TabBackground from '../components/TabBackground';
import { useChatsRoomsLoader } from '../hooks/useChatsRoomsLoader';
import { useChatsSearchReveal, CHATS_SEARCH_BOTTOM_SPACING_PX } from '../hooks/useChatsSearchReveal';
import ChatsListRow from '../components/chats/ChatsListRow';
import { clearPreviewCache } from './chats/chatsPreviewCache';
import { filterChatsRows, buildChatsListData } from './chats/chatsListData';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import { useSplitDetail } from '../context/SplitDetailContext';
import { isBlocked } from '../lib/blockedContacts';
import { navigateToBlockedContacts } from '../lib/navigateToBlockedContacts';
import ChatClearHistoryConfirmModal from '../components/chat/ChatClearHistoryConfirmModal';

const ReanimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function ChatsScreen({ route, navigation }) {
  const nickname = useNicknameFromRoute(route);
  const isSplit = useIsSplitLayout();
  const { setDetailParams } = useSplitDetail();
  useEffect(() => {
    clearPreviewCache();
  }, [nickname]);

  const [q, setQ] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const headerLayout = useMessengerHeaderLayout();

  const { rows, removeRowsByRoomIds } = useChatsRoomsLoader(nickname);

  const mainTabsNav = useMainTabsNavigationOptional();
  const acquirePagerLock = mainTabsNav?.acquirePagerInteractionLock;
  const releasePagerLock = mainTabsNav?.releasePagerInteractionLock;
  const resetPagerLock = mainTabsNav?.resetPagerInteractionLock;

  const {
    SEARCH_FIELD_H,
    setSearchShown,
    listScrollY,
    listMaxScrollY,
    searchDragActive,
    searchDragActiveRef,
    pullGesture,
    contentBounceStyle,
    scrollHandler,
    searchBarWrapStyle,
    searchBarWrapAnimatedProps,
    searchBarInnerStyle,
    iconStyle,
    listScrollAnimatedProps,
  } = useChatsSearchReveal(q, searchFocused);

  const listScrollDragRef = useRef(false);

  const onListScrollBeginDrag = useCallback(() => {
    if (searchDragActiveRef.current) return;
    listScrollDragRef.current = true;
    acquirePagerLock?.();
  }, [acquirePagerLock, searchDragActiveRef]);

  const onListScrollEndDrag = useCallback(
    (e) => {
      const vy = e?.nativeEvent?.velocity?.y ?? 0;
      if (Math.abs(vy) < 0.15) {
        listScrollDragRef.current = false;
        releasePagerLock?.();
      }
    },
    [releasePagerLock],
  );

  const onListMomentumScrollEnd = useCallback(() => {
    if (listScrollDragRef.current) {
      listScrollDragRef.current = false;
      releasePagerLock?.();
    }
  }, [releasePagerLock]);

  useFocusEffect(
    useCallback(
      () => () => {
        listScrollDragRef.current = false;
        resetPagerLock?.();
      },
      [resetPagerLock],
    ),
  );

  const { animatedStyle: bottomBounceStyle, wrapGesture, overscrollProps } = useAndroidTabOverscroll({
    scrollY: listScrollY,
    maxScrollY: listMaxScrollY,
    suppressTopBounce: true,
    acquirePagerLock,
    releasePagerLock,
    searchDragActive,
  });
  const listScrollGesture = wrapGesture(Gesture.Native()) ?? Gesture.Native();
  const chatsGesture = useMemo(
    () => Gesture.Simultaneous(pullGesture, listScrollGesture),
    [pullGesture, listScrollGesture],
  );

  const filtered = useMemo(() => filterChatsRows(rows, q), [q, rows]);

  const listData = useMemo(() => buildChatsListData(q, filtered), [q, filtered]);

  const navigateToChat = useCallback(
    async (item) => {
      if (item.isAria) {
        const params = {
          roomId: ARIA_ROOM_ID,
          isAriaChat: true,
          contact: ARIA_CONTACT,
          nickname,
          title: ARIA_CONTACT.display_name,
          peerName: ARIA_CONTACT.display_name };
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
        title: item.contactName };
      if (isSplit) {
        setDetailParams({ type: 'Room', params });
      } else {
        navigation.navigate('Room', params);
      }
    },
    [nickname, navigation, isSplit, setDetailParams],
  );

  const {
    selectionMode,
    selectedRoomIds,
    selectedHash,
    exitSelectionMode,
    handleChatPress,
    handleChatLongPress,
    openDeleteConfirm,
    deleteConfirmVisible,
    closeDeleteConfirm,
    confirmDeleteChats,
    deleteModalTitle,
    deleteInProgress,
  } = useChatsSelection({
    nickname,
    rows,
    onNavigateToChat: navigateToChat,
    removeRowsByRoomIds,
  });

  const renderItem = useCallback(
    ({ item }) => {
      const roomKey = item.isAria ? null : item.roomId;
      return (
        <ChatsListRow
          item={item}
          nickname={nickname}
          selectionMode={selectionMode}
          isSelected={roomKey != null && selectedRoomIds.has(roomKey)}
          onPress={() => handleChatPress(item)}
          onLongPress={() => handleChatLongPress(item)}
        />
      );
    },
    [
      nickname,
      selectionMode,
      selectedRoomIds,
      handleChatPress,
      handleChatLongPress,
    ],
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
              justifyContent: 'space-between' }]}
        >
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={exitSelectionMode} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={[tw`text-[14px]`, { color: V.accentSage }]}>Отмена</Text>
              </TouchableOpacity>
              <Text style={[tw`text-[13px] font-medium`, { color: V.textPrimary }]}>
                {selectedRoomIds.size} выбрано
              </Text>
              <TouchableOpacity
                onPress={openDeleteConfirm}
                disabled={selectedRoomIds.size === 0}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ opacity: selectedRoomIds.size === 0 ? 0.35 : 1 }}
                accessibilityRole="button"
                accessibilityLabel="Удалить выбранные чаты"
              >
                <Trash2 size={20} color={V.dangerMuted} strokeWidth={1.5} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
                Vault
              </Text>
              <Animated.View style={iconStyle}>
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
            </>
          )}
        </View>

        <GestureDetector gesture={chatsGesture}>
          <Animated.View style={[tw`flex-1`, contentBounceStyle]}>
            <Animated.View
              animatedProps={searchBarWrapAnimatedProps}
              style={[
                { marginHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL },
                searchBarWrapStyle,
              ]}
            >
              <Animated.View style={searchBarInnerStyle}>
                <View style={{ marginBottom: CHATS_SEARCH_BOTTOM_SPACING_PX }}>
                  <SafeBlurView
                    intensity={28}
                    tint="dark"
                    blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
                    style={[
                      tw`flex-row items-center`,
                      {
                        minHeight: SEARCH_FIELD_H,
                        borderRadius: SEARCH_CHATS_CAPSULE_RADIUS,
                        overflow: 'hidden',
                        paddingHorizontal: SEARCH_FIELD_LAYOUT.rowPaddingH,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: 'rgba(255,255,255,0.13)',
                        backgroundColor: 'rgba(255,255,255,0.06)' },
                    ]}
                  >
                    <Search
                      size={14}
                      strokeWidth={1.5}
                      color={V.textMuted}
                      style={{ marginRight: 8, flexShrink: 0 }}
                    />
                    <TextInput
                      ref={searchInputRef}
                      style={[
                        tw`flex-1 text-[15px]`,
                        {
                          color: V.textPrimary,
                          paddingVertical: 0,
                          height: SEARCH_FIELD_H,
                        },
                      ]}
                      placeholder="Поиск..."
                      placeholderTextColor={V.textMuted}
                      value={q}
                      onChangeText={setQ}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => {
                        setSearchFocused(false);
                        if (!q.trim()) setSearchShown(false);
                      }}
                    />
                    {!!q && (
                      <TouchableOpacity
                        onPress={() => setQ('')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={tw`ml-2`}
                        accessibilityRole="button"
                        accessibilityLabel="Очистить поиск"
                      >
                        <Text style={[tw`text-[18px]`, { color: V.textPrimary, lineHeight: 18 }]}>
                          ×
                        </Text>
                      </TouchableOpacity>
                    )}
                  </SafeBlurView>
                </View>
              </Animated.View>
            </Animated.View>

            <Animated.View style={[tw`flex-1`, bottomBounceStyle]}>
              <View
                style={[
                  tw`flex-1`,
                  { paddingHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL },
                ]}
              >
                <ReanimatedFlatList
                  animatedProps={listScrollAnimatedProps}
                  data={listData}
                  extraData={selectedHash}
                  keyExtractor={(i) => (i.isAria ? ARIA_ROOM_ID : i.roomId)}
                  renderItem={renderItem}
                  onScroll={scrollHandler}
                  onScrollBeginDrag={onListScrollBeginDrag}
                  onScrollEndDrag={onListScrollEndDrag}
                  onMomentumScrollEnd={onListMomentumScrollEnd}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  {...overscrollProps}
                ListEmptyComponent={
                  <View style={tw`py-10`}>
                    {q.trim().length > 0 ? (
                      <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
                        Контакты не найдены
                      </Text>
                    ) : (
                      <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
                        Пока нет чатов.
                      </Text>
                    )}
                  </View>
                }
                showsVerticalScrollIndicator={false}
                />
              </View>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <ChatClearHistoryConfirmModal
        uiReady
        visible={deleteConfirmVisible}
        confirmDisabled={deleteInProgress}
        onClose={closeDeleteConfirm}
        onConfirm={confirmDeleteChats}
        title={deleteModalTitle}
        description={
          selectedRoomIds.size === 1
            ? 'Чат исчезнет из списка. Сообщения скроются согласно выбранному варианту.'
            : 'Чаты исчезнут из списка. Сообщения скроются согласно выбранному варианту.'
        }
        confirmLabel="Удалить"
      />
    </TabBackground>
  );
}
