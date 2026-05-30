import React, { useCallback, useMemo } from 'react';
import { View, Text, Platform, FlatList, ActivityIndicator } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { runOnJS } from 'react-native-reanimated';
import tw from 'twrnc';
import { V } from '../../theme';
import { useAndroidTabOverscroll } from '../../hooks/useAndroidTabOverscroll';
import ChatMessagesLoadingOverlay from './ChatMessagesLoadingOverlay';
import ChatListFooter from './ChatListFooter';

export default function ChatMessageList({
  flatListRef,
  formattedMessages,
  renderItem,
  listExtraDataStable,
  listAnimatedStyle,
  listBottomSpacerStyle,
  onListScroll,
  layoutReadyRef,
  initialScrollDoneRef,
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
  const { androidBounce, scrollHandler, animatedStyle: listBounceStyle, overscrollProps, wrapGesture } =
    useAndroidTabOverscroll({
      enabled: overscrollEnabled,
      inverted: true,
      onScrollExtra: onListScroll
        ? (e) => {
            'worklet';
            runOnJS(onListScroll)({
              nativeEvent: { contentOffset: { y: e.contentOffset.y } },
            });
          }
        : undefined,
    });
  const mergedOnScroll = onListScroll ?? scrollHandler;

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
    onLoadOlderMessages?.();
  }, [onLoadOlderMessages]);

  const messageList = (
    <FlatList
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
      onContentSizeChange={() => {
        if (!layoutReadyRef.current) {
          layoutReadyRef.current = true;
          initialScrollDoneRef.current = true;
        }
      }}
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
      <Reanimated.View style={[tw`flex-1`, listAnimatedStyle, {}]}>{listBody}</Reanimated.View>
    </View>
  );
}
