import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import tw from 'twrnc';
import { useAndroidTabOverscroll } from '../hooks/useAndroidTabOverscroll';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { useChatsSelection } from '../hooks/useChatsSelection';
import TabBackground from '../components/TabBackground';
import { useChatsRoomsLoader } from '../hooks/useChatsRoomsLoader';
import { useChatReadCursors } from '../hooks/useChatReadCursors';
import {
  useChatsSearchReveal,
  CHATS_SEARCH_BOTTOM_SPACING_PX,
} from '../hooks/useChatsSearchReveal';
import { useChatsScreenPagerScroll } from '../hooks/useChatsScreenPagerScroll';
import { useAriaOverscroll } from '../hooks/useAriaOverscroll';
import { useAriaChatSession } from '../hooks/useAriaChatSession';
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
import ChatHeaderOverflowMenuModal from '../components/chat/ChatHeaderOverflowMenuModal';
import { V } from '../theme';
import { registerOpenAriaFromPush } from '../lib/ariaPushNavigation';

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
  const [ariaOverflowVisible, setAriaOverflowVisible] = useState(false);
  const [ariaClearConfirmVisible, setAriaClearConfirmVisible] = useState(false);
  const [ariaClearInProgress, setAriaClearInProgress] = useState(false);
  const searchInputRef = useRef(null);
  const headerLayout = useMessengerHeaderLayout();

  useFocusEffect(
    useCallback(() => {
      searchInputRef.current?.blur?.();
      Keyboard.dismiss();
    }, []),
  );

  const { rows, removeRowsByRoomIds } = useChatsRoomsLoader(nickname);
  const { cursors, isRowUnread } = useChatReadCursors(nickname);

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

  useEffect(() => {
    return registerOpenAriaFromPush(() => {
      openAriaPanel();
    });
  }, [openAriaPanel]);

  const {
    ariaMessages,
    ariaResolvedNickname,
    sendToAria,
    ariaOnline,
    clearAriaHistory,
    markAriaRevealDone,
    submitAriaFeedback,
  } = useAriaChatSession(ariaVisible, nickname);

  const confirmAriaClearHistory = useCallback(async () => {
    if (ariaClearInProgress) return;
    setAriaClearInProgress(true);
    try {
      await clearAriaHistory();
      setAriaClearConfirmVisible(false);
    } finally {
      setAriaClearInProgress(false);
    }
  }, [ariaClearInProgress, clearAriaHistory]);

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
    openAriaPanel,
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
          isUnread={isRowUnread(item)}
          selectionMode={selectionMode}
          isSelected={roomKey != null && selectedRoomIds.has(roomKey)}
          onPress={() => handleChatPress(item)}
          onLongPress={() => handleChatLongPress(item)}
        />
      );
    },
    [nickname, selectionMode, selectedRoomIds, handleChatPress, handleChatLongPress, isRowUnread],
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

  const ariaBackdropScrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ariaPullProgress.value, [0, 1], [0, 0.4]),
  }));

  return (
    <TabBackground backgroundColor={V.bgChatsScreen} testID="chats-screen">
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
                extraData={{ selectedHash, cursors }}
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

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.ariaBackdropScrim,
          ariaBackdropScrimStyle,
        ]}
      />

      <AriaPanelOverlay
        pullProgress={ariaPullProgress}
        committedSv={ariaCommittedSv}
        committed={ariaVisible}
        onClose={closeAriaPanel}
        headerMinHeight={headerLayout.minHeight}
        ariaMessages={ariaMessages}
        ariaDisplayNickname={
          ariaResolvedNickname !== null ? ariaResolvedNickname : nickname
        }
        sendToAria={sendToAria}
        ariaOnline={ariaOnline}
        onAriaRevealComplete={markAriaRevealDone}
        onAriaFeedback={submitAriaFeedback}
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
          ariaPanelOpen={ariaVisible}
          onOpenAriaOverflow={() => setAriaOverflowVisible(true)}
        />
      </View>

      <ChatHeaderOverflowMenuModal
        uiReady
        visible={ariaOverflowVisible}
        onClose={() => setAriaOverflowVisible(false)}
        onClearHistory={() => {
          setAriaOverflowVisible(false);
          setAriaClearConfirmVisible(true);
        }}
      />

      <ChatClearHistoryConfirmModal
        uiReady
        visible={ariaClearConfirmVisible}
        confirmDisabled={ariaClearInProgress}
        onClose={() => {
          if (!ariaClearInProgress) setAriaClearConfirmVisible(false);
        }}
        onConfirm={() => {
          void confirmAriaClearHistory();
        }}
        title="Очистить переписку?"
        description="Переписка с Aria будет удалена безвозвратно."
        confirmLabel="Очистить"
        showEveryoneCheckbox={false}
      />

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
  ariaBackdropScrim: {
    backgroundColor: '#000000',
    zIndex: 4,
  },
});
