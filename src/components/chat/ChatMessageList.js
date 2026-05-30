import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Platform, FlatList, ActivityIndicator } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { runOnJS } from 'react-native-reanimated';
import tw from 'twrnc';
import { V } from '../../theme';
import { useAndroidTabOverscroll } from '../../hooks/useAndroidTabOverscroll';
import ChatMessagesLoadingOverlay from './ChatMessagesLoadingOverlay';
import ChatListFooter from './ChatListFooter';
import { canLoadOlderOnEndReached } from './chatListScrollStick';
import { CHAT_AT_BOTTOM_THRESHOLD_PX } from './chatViewConstants';

export default function ChatMessageList({
  roomId,
  flatListRef,
  formattedMessages,
  renderItem,
  listExtraDataStable,
  listAnimatedStyle,
  listBottomSpacerStyle,
  onListScroll,
  onListLayoutReady,
  onListContentResize,
  messagesLoading,
  chatRoomHeader,
  listPaddingTop,
  listFooterPaddingTop,
  selectionMode,
  selectedIds,
  exitSelectionMode,
  batchDeleteForMe,
  overscrollEnabled = true,
  loadingOlder = false,
  onLoadOlderMessages,
}) {
  const listMetricsRef = useRef({ contentH: 0, layoutH: 0 });
  const userScrolledToHistoryRef = useRef(false);

  useEffect(() => {
    if (formattedMessages.length === 0) {
      userScrolledToHistoryRef.current = false;
    }
  }, [formattedMessages.length]);

  const trackHistoryScrollOffset = useCallback((offsetY) => {
    if (offsetY > CHAT_AT_BOTTOM_THRESHOLD_PX) {
      userScrolledToHistoryRef.current = true;
    }
  }, []);

  const handleListScroll = useCallback(
    (e) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      trackHistoryScrollOffset(y);
      onListScroll?.(e);
    },
    [onListScroll, trackHistoryScrollOffset],
  );

  const { androidBounce, scrollHandler, animatedStyle: listBounceStyle, overscrollProps, wrapGesture } =
    useAndroidTabOverscroll({
      enabled: overscrollEnabled,
      inverted: true,
      onScrollExtra: (e) => {
        'worklet';
        runOnJS(trackHistoryScrollOffset)(e.contentOffset.y);
        if (onListScroll) {
          runOnJS(onListScroll)({
            nativeEvent: { contentOffset: { y: e.contentOffset.y } },
          });
        }
      },
    });
  const mergedOnScroll = onListScroll ? handleListScroll : scrollHandler;

  const ListBottomInsetHeader = useCallback(
    () => <Reanimated.View collapsable={false} style={listBottomSpacerStyle} />,
    [listBottomSpacerStyle],
  );

  const listFooterComponent = useMemo(
    () => (
      <>
        {loadingOlder ? (
          <View style={{ paddingVertical: 10, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={V.textMuted} />
          </View>
        ) : null}
        <ChatListFooter
          chatRoomHeader={chatRoomHeader}
          listPaddingTop={listFooterPaddingTop}
          selectionMode={selectionMode}
          selectedCount={selectedIds.size}
          onExitSelection={exitSelectionMode}
          onBatchDeleteForMe={batchDeleteForMe}
        />
      </>
    ),
    [
      loadingOlder,
      chatRoomHeader,
      listFooterPaddingTop,
      selectionMode,
      selectedIds.size,
      exitSelectionMode,
      batchDeleteForMe,
    ],
  );

  const maintainVisible = useMemo(
    () =>
      Platform.OS === 'web'
        ? undefined
        : {
            minIndexForVisible: 1,
            autoscrollToTopThreshold: 24,
          },
    [],
  );

  const handleEndReached = useCallback(() => {
    const { contentH, layoutH } = listMetricsRef.current;
    if (
      !canLoadOlderOnEndReached(
        contentH,
        layoutH,
        userScrolledToHistoryRef.current,
      )
    ) {
      return;
    }
    onLoadOlderMessages?.();
  }, [onLoadOlderMessages]);

  const handleListLayout = useCallback((e) => {
    listMetricsRef.current.layoutH = e.nativeEvent.layout.height;
  }, []);

  const handleContentSizeChange = useCallback(
    (_w, h) => {
      listMetricsRef.current.contentH = h;
      onListLayoutReady?.();
      onListContentResize?.();
    },
    [onListLayoutReady, onListContentResize],
  );

  const messageList = (
    <FlatList
      key={roomId ?? 'no-room'}
      {...overscrollProps}
      ref={flatListRef}
      data={formattedMessages}
      inverted
      keyExtractor={(item) =>
        item.clientRowKey != null && item.clientRowKey !== ''
          ? String(item.clientRowKey)
          : String(item.id)
      }
      renderItem={renderItem}
      extraData={listExtraDataStable}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={10}
      onScroll={androidBounce ? scrollHandler : mergedOnScroll}
      scrollEventThrottle={32}
      onLayout={handleListLayout}
      onScrollToIndexFailed={(info) => {
        flatListRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
      }}
      decelerationRate={Platform.OS === 'ios' ? 0.992 : 'fast'}
      style={[
        tw`flex-1`,
        chatRoomHeader ? { backgroundColor: 'transparent' } : null,
        { zIndex: 1 },
      ]}
      removeClippedSubviews={Platform.OS === 'android'}
      maintainVisibleContentPosition={maintainVisible}
      onEndReached={onLoadOlderMessages ? handleEndReached : undefined}
      onEndReachedThreshold={0.2}
      ListHeaderComponent={ListBottomInsetHeader}
      ListFooterComponent={listFooterComponent}
      contentContainerStyle={[
        tw`pt-1`,
        chatRoomHeader && typeof listPaddingTop === 'number' && listPaddingTop > 0
          ? null
          : tw`pb-2`,
      ]}
      onContentSizeChange={handleContentSizeChange}
      ListEmptyComponent={
        messagesLoading ? null : (
          <Text style={[tw`text-center py-6 text-[13px]`, { color: V.textMuted }]}>
            Начни общение!
          </Text>
        )
      }
    />
  );

  const listBody = androidBounce ? (
    <GestureDetector gesture={wrapGesture(null)}>
      <Reanimated.View style={[tw`flex-1`, listBounceStyle]}>{messageList}</Reanimated.View>
    </GestureDetector>
  ) : (
    messageList
  );

  return (
    <View style={{ flex: 1 }}>
      <ChatMessagesLoadingOverlay visible={messagesLoading} />
      <Reanimated.View style={[tw`flex-1`, listAnimatedStyle]}>{listBody}</Reanimated.View>
    </View>
  );
}
