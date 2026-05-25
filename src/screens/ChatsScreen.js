import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { useAndroidTabOverscroll } from '../hooks/useAndroidTabOverscroll';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { useChatsSelection } from '../hooks/useChatsSelection';
import TabBackground from '../components/TabBackground';
import { useChatsRoomsLoader } from '../hooks/useChatsRoomsLoader';
import {
  useChatsSearchReveal,
  CHATS_SEARCH_BOTTOM_SPACING_PX,
} from '../hooks/useChatsSearchReveal';
import { useChatsScreenPagerScroll } from '../hooks/useChatsScreenPagerScroll';
import ChatsListRow from '../components/chats/ChatsListRow';
import ChatsScreenHeader from '../components/chats/ChatsScreenHeader';
import ChatsCollapsibleSearchField from '../components/chats/ChatsCollapsibleSearchField';
import ChatsScreenFlatList from '../components/chats/ChatsScreenFlatList';
import { clearPreviewCache } from './chats/chatsPreviewCache';
import { filterChatsRows, buildChatsListData } from './chats/chatsListData';
import { useChatsNavigateToChat } from './chats/useChatsNavigateToChat';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import { useSplitDetail } from '../context/SplitDetailContext';
import ChatClearHistoryConfirmModal from '../components/chat/ChatClearHistoryConfirmModal';

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

  const {
    onListScrollBeginDrag,
    onListScrollEndDrag,
    onListMomentumScrollEnd,
  } = useChatsScreenPagerScroll({
    acquirePagerLock,
    releasePagerLock,
    resetPagerLock,
    searchDragActiveRef,
  });

  const { animatedStyle: bottomBounceStyle, wrapGesture, overscrollProps } =
    useAndroidTabOverscroll({
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

  const navigateToChat = useChatsNavigateToChat({
    nickname,
    navigation,
    isSplit,
    setDetailParams,
  });

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
    [nickname, selectionMode, selectedRoomIds, handleChatPress, handleChatLongPress],
  );

  const onOpenSearch = useCallback(() => {
    setSearchShown(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus?.();
    });
  }, [setSearchShown]);

  const onSearchBlur = useCallback(() => {
    setSearchFocused(false);
    if (!q.trim()) setSearchShown(false);
  }, [q, setSearchShown]);

  const searchWrapStyle = useMemo(
    () => [{ marginHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL }, searchBarWrapStyle],
    [searchBarWrapStyle],
  );

  return (
    <TabBackground>
      <View style={[tw`flex-1`, { backgroundColor: 'transparent' }]}>
        <ChatsScreenHeader
          containerStyle={headerLayout.containerStyle}
          selectionMode={selectionMode}
          selectedCount={selectedRoomIds.size}
          onExitSelection={exitSelectionMode}
          onOpenDeleteConfirm={openDeleteConfirm}
          searchIconStyle={iconStyle}
          onOpenSearch={onOpenSearch}
        />

        <GestureDetector gesture={chatsGesture}>
          <Animated.View style={[tw`flex-1`, contentBounceStyle]}>
            <ChatsCollapsibleSearchField
              searchFieldHeight={SEARCH_FIELD_H}
              searchBottomSpacingPx={CHATS_SEARCH_BOTTOM_SPACING_PX}
              wrapAnimatedProps={searchBarWrapAnimatedProps}
              wrapStyle={searchWrapStyle}
              innerStyle={searchBarInnerStyle}
              inputRef={searchInputRef}
              query={q}
              onChangeQuery={setQ}
              onFocus={() => setSearchFocused(true)}
              onBlur={onSearchBlur}
            />

            <Animated.View style={[tw`flex-1`, bottomBounceStyle]}>
              <View
                style={[
                  tw`flex-1`,
                  { paddingHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL },
                ]}
              >
                <ChatsScreenFlatList
                  listAnimatedProps={listScrollAnimatedProps}
                  data={listData}
                  extraData={selectedHash}
                  renderItem={renderItem}
                  onScroll={scrollHandler}
                  onScrollBeginDrag={onListScrollBeginDrag}
                  onScrollEndDrag={onListScrollEndDrag}
                  onMomentumScrollEnd={onListMomentumScrollEnd}
                  overscrollProps={overscrollProps}
                  query={q}
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
