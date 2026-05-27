import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { V } from '../theme';

function ChatsListTopInset({ style }) {
  return <Animated.View style={style} />;
}

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

  useFocusEffect(
    useCallback(() => {
      searchInputRef.current?.blur?.();
      Keyboard.dismiss();
    }, []),
  );

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
    topPullBounceStyle,
    scrollHandler,
    searchBarWrapStyle,
    searchBarWrapAnimatedProps,
    searchBarInnerStyle,
    iconStyle,
    listScrollAnimatedProps,
    listTopInsetStyle,
  } = useChatsSearchReveal(q, searchFocused, headerLayout.minHeight);

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

  const listTopInset = useMemo(
    () => <ChatsListTopInset style={listTopInsetStyle} />,
    [listTopInsetStyle],
  );

  return (
    <TabBackground>
      <GestureDetector gesture={chatsGesture}>
        <Animated.View style={[tw`flex-1`, topPullBounceStyle]}>
          <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.listLayer, bottomBounceStyle]}
          >
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
                ListHeaderComponent={listTopInset}
              />
            </View>
          </Animated.View>

          <View
            style={[styles.searchOverlay, { top: headerLayout.minHeight }]}
            pointerEvents="box-none"
          >
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
          </View>

          <View style={styles.headerOverlay} pointerEvents="box-none">
            <ChatsScreenHeader
              containerStyle={headerLayout.containerStyle}
              selectionMode={selectionMode}
              selectedCount={selectedRoomIds.size}
              onExitSelection={exitSelectionMode}
              onOpenDeleteConfirm={openDeleteConfirm}
              searchIconStyle={iconStyle}
              onOpenSearch={onOpenSearch}
            />
          </View>
        </Animated.View>
      </GestureDetector>

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

const styles = StyleSheet.create({
  listLayer: {
    zIndex: 0,
  },
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: V.bgApp,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: V.bgApp,
  },
});
