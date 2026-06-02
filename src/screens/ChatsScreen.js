import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';
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
import { useAriaOverscroll } from '../hooks/useAriaOverscroll';
import ChatsListRow from '../components/chats/ChatsListRow';
import ChatsHeaderGlow from '../components/chats/ChatsHeaderGlow';
import ChatsScreenHeader from '../components/chats/ChatsScreenHeader';
import AriaPanelOverlay from '../components/chats/AriaPanelOverlay';
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
  const acquireTabBarSuppress = mainTabsNav?.acquireTabBarSuppress;
  const releaseTabBarSuppress = mainTabsNav?.releaseTabBarSuppress;
  const registerAriaTabBarHideSv = mainTabsNav?.registerAriaTabBarHideSv;

  const ariaPullReleasePx = useSharedValue(0);
  const ariaPullReleaseTick = useSharedValue(0);
  const ariaCommittedSv = useSharedValue(0);
  const ariaPullProgress = useSharedValue(0);
  const ariaTabBarHideSv = useSharedValue(0);

  useEffect(() => {
    if (!registerAriaTabBarHideSv) {
      return undefined;
    }
    return registerAriaTabBarHideSv(ariaTabBarHideSv);
  }, [ariaTabBarHideSv, registerAriaTabBarHideSv]);

  const {
    SEARCH_FIELD_H,
    topPullPx,
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
  } = useChatsSearchReveal(
    q,
    searchFocused,
    headerLayout.minHeight,
    ariaPullReleasePx,
    ariaPullReleaseTick,
    ariaCommittedSv,
    ariaPullProgress,
  );

  const {
    ariaGlowIntensity,
    ariaVisible,
    openAriaPanel,
    closeAriaPanel,
  } = useAriaOverscroll({
    topPullPx,
    searchDragActive,
    ariaPullReleasePx,
    ariaPullReleaseTick,
    ariaCommittedSv,
    ariaPullProgress,
    ariaTabBarHideSv,
    acquirePagerLock,
    releasePagerLock,
    acquireTabBarSuppress,
    releaseTabBarSuppress,
  });

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

  const {
    animatedStyle: bottomBounceStyle,
    wrapGesture,
    overscrollProps,
    overscrollY: androidOverscrollY,
  } = useAndroidTabOverscroll({
    scrollY: listScrollY,
    maxScrollY: listMaxScrollY,
    suppressTopBounce: Platform.OS !== 'android',
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

  const headerShellStyle = useMemo(
    () => ({
      top: -headerLayout.blurExtendTop,
      height: headerLayout.minHeight + headerLayout.blurExtendTop,
    }),
    [headerLayout.blurExtendTop, headerLayout.minHeight],
  );

  const headerGlowShellStyle = useMemo(
    () => ({
      top: headerShellStyle.top,
      height: headerShellStyle.height - 8,
    }),
    [headerShellStyle],
  );

  return (
    <TabBackground backgroundColor={V.bgChatsScreen}>
      <GestureDetector gesture={chatsGesture}>
        <Animated.View
          style={[tw`flex-1`, topPullBounceStyle]}
          pointerEvents={ariaVisible ? 'none' : 'auto'}
        >
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
        </Animated.View>
      </GestureDetector>

      <AriaPanelOverlay
        pullProgress={ariaPullProgress}
        committedSv={ariaCommittedSv}
        committed={ariaVisible}
        onClose={closeAriaPanel}
        headerMinHeight={headerLayout.minHeight}
      />

      <View
        style={[styles.headerGlowOverlay, headerGlowShellStyle]}
        pointerEvents="none"
      >
        <ChatsHeaderGlow
          topPullPx={topPullPx}
          listScrollY={listScrollY}
          searchDragActive={searchDragActive}
          androidOverscrollY={androidOverscrollY}
        />
      </View>

      <View style={[styles.headerOverlay, headerShellStyle]} pointerEvents="box-none">
        <ChatsScreenHeader
          blurExtendTop={headerLayout.blurExtendTop}
          containerStyle={headerLayout.containerStyle}
          selectionMode={selectionMode}
          selectedCount={selectedRoomIds.size}
          onExitSelection={exitSelectionMode}
          onOpenDeleteConfirm={openDeleteConfirm}
          searchIconStyle={iconStyle}
          onOpenSearch={onOpenSearch}
          ariaGlowIntensity={ariaGlowIntensity}
          onOpenAria={openAriaPanel}
        />
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

const styles = StyleSheet.create({
  listLayer: {
    zIndex: 0,
  },
  searchOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: V.bgChatsScreen,
  },
  headerGlowOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 8,
    overflow: 'hidden',
  },
  headerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
});
