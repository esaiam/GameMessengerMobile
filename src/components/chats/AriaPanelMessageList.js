import React, { useCallback, useMemo, useRef } from 'react';
import { FlatList, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useChatFormattedMessagesState } from '../../hooks/useChatFormattedMessagesState';
import { useChatInvertedListScroll } from '../../hooks/useChatInvertedListScroll';
import { ARIA_ROOM_ID } from '../../lib/aria';
import { TAB_OVERSCROLL_PROPS } from '../../theme';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../MessengerHeaderLayout';
import useChatMessageListRender from '../chat/useChatMessageListRender';
import useMessageRowAnimations from '../chat/useMessageRowAnimations';

const LIST_TOP_PAD = 12;
const LIST_BOTTOM_PAD = 8;

/**
 * Inverted-лента Aria в шторке — только нативный скролл, без dismiss-жестов на списке.
 */
export default function AriaPanelMessageList({ messages, nickname, scrollEnabled }) {
  const { width: windowWidth } = useWindowDimensions();
  const roomKey = scrollEnabled ? ARIA_ROOM_ID : null;
  const formattedMessages = useChatFormattedMessagesState(messages, roomKey);
  const activatedVideoIdsRef = useRef(new Set());
  const selectedIdsEmpty = useMemo(() => new Set(), []);
  const { ensureMessageAnims } = useMessageRowAnimations(messages);

  const { flatListRef, onScroll, onListLayoutReady } = useChatInvertedListScroll(
    roomKey,
    messages,
    null,
    null,
    true,
  );

  const noop = useCallback(() => {}, []);
  const noopAsync = useCallback(async () => {}, []);

  const { renderItem, listExtraDataStable } = useChatMessageListRender({
    formattedMessages,
    nickname: typeof nickname === 'string' ? nickname : '',
    windowWidth,
    selectedIds: selectedIdsEmpty,
    getReplyMessage: () => null,
    ensureMessageAnims,
    setFullScreenImage: noop,
    handleMessagePress: noop,
    handleMessageLongPress: noop,
    toggleReaction: noop,
    playVoiceMessage: noopAsync,
    activateVideo: noop,
    activatedVideoIds: activatedVideoIdsRef,
    replyToMessage: null,
    isAriaChat: true,
    ariaPlainPanel: true,
    openCalendarFromSeparator: noop,
    activeVoiceUri: null,
    activePlayerStatus: { playing: false, currentTime: 0, duration: 0 },
    activeVoiceMessageId: null,
    activeVideoId: null,
    isRecordingVoice: false,
    selectionMode: false,
    selectedHash: '',
    renderableVideoIds: null,
    onUnlockVideo: noop,
  });

  if (!scrollEnabled) {
    return null;
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={flatListRef}
        data={formattedMessages}
        inverted
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={listExtraDataStable}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={() => {
          if (formattedMessages.length > 0) onListLayoutReady?.();
        }}
        onContentSizeChange={() => onListLayoutReady?.()}
        scrollEnabled
        style={styles.list}
        contentContainerStyle={styles.content}
        initialNumToRender={16}
        maxToRenderPerBatch={8}
        windowSize={8}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
        decelerationRate={Platform.OS === 'ios' ? 0.992 : 'fast'}
        {...TAB_OVERSCROLL_PROPS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: LIST_TOP_PAD,
    paddingBottom: LIST_BOTTOM_PAD,
    paddingHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL,
  },
});
