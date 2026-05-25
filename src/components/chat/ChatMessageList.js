import React, { useCallback, useMemo } from 'react';
import { View, Text, Platform, FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
}) {
  const { scrollHandler, animatedStyle: listBounceStyle, overscrollProps, wrapGesture } =
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
  const listGesture = wrapGesture?.(null) ?? Gesture.Native();

  const ListBottomInsetHeader = useCallback(
    () => <Reanimated.View collapsable={false} style={listBottomSpacerStyle} />,
    [listBottomSpacerStyle],
  );

  const listFooterComponent = useMemo(
    () => (
      <ChatListFooter
        chatRoomHeader={chatRoomHeader}
        listPaddingTop={listFooterPaddingTop}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onExitSelection={exitSelectionMode}
        onBatchDeleteForMe={batchDeleteForMe}
      />
    ),
    [
      chatRoomHeader,
      listFooterPaddingTop,
      selectionMode,
      selectedIds.size,
      exitSelectionMode,
      batchDeleteForMe,
    ],
  );

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
      onScroll={scrollHandler ?? onListScroll}
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

  return (
    <View style={{ flex: 1 }}>
      <ChatMessagesLoadingOverlay visible={messagesLoading} />
      <Reanimated.View style={[tw`flex-1`, listAnimatedStyle, {}]}>
        <GestureDetector gesture={listGesture}>
          <Reanimated.View style={[tw`flex-1`, listBounceStyle]}>{messageList}</Reanimated.View>
        </GestureDetector>
      </Reanimated.View>
    </View>
  );
}
