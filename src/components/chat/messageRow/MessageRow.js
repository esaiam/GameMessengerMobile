import React, { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import ChatReactionsBar from '../ChatReactionsBar';
import ChatDateSeparator from '../ChatDateSeparator';
import { deriveMessageRowFlags, resolveMessageRowKind } from './deriveMessageRowKind';
import { getMessageBubbleRadii } from './getMessageBubbleRadii';
import { useDoubleTapPress } from './useDoubleTapPress';
import { useMessageRowSelectionBounce } from './useMessageRowSelectionBounce';
import MessageRowBubbleInner from './MessageRowBubbleInner';
import MessageRowAriaPlain from './MessageRowAriaPlain';
import MessageRowBubbleChrome from './MessageRowBubbleChrome';
import { messageRowPropsAreEqual } from './messageRowMemoCompare';
import { REACTION_OVERLAY_ROW_RESERVE } from '../messageBubbleLayoutConstants';

const HEART_REACTION_EMOJI = '❤️';

/** @see ./messageRowEnvContract.js MessageRowEnv */
const MessageRow = React.memo(
  function MessageRow({
    item,
    index,
    listExtra,
    activeVoiceMessageId,
    activeVoiceUri,
    activeVideoId,
    isRecordingVoice,
    voicePlaybackSig,
    fmtLenRef,
    rowEnvRef,
    onMessagePress,
    onMessageLongPress,
  }) {
    const env = rowEnvRef.current;
    const listLength = fmtLenRef.current;
    const rowFlags = deriveMessageRowFlags(item, listExtra, env);
    const rowKind = resolveMessageRowKind(rowFlags);
    const { isMine, isVideoMessage, isAriaTyping } = rowFlags;

    const emitMessageLongPress = (e) => {
      const x = e?.nativeEvent?.pageX ?? 0;
      const y = e?.nativeEvent?.pageY ?? 0;
      onMessageLongPress({ nativeEvent: { pageX: x, pageY: y } }, item);
    };
    const fireReply = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      rowEnvRef.current.replyToMessage?.(item);
    }, [item]);
    const fireHeartReaction = useCallback(() => {
      if (listExtra.isAriaChat || listExtra.selectionMode) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      rowEnvRef.current.toggleReaction(item.id, HEART_REACTION_EMOJI);
    }, [item.id, listExtra.isAriaChat, listExtra.selectionMode]);
    const handleMessagePress = useDoubleTapPress(
      (e) => onMessagePress(e, item),
      fireHeartReaction,
    );

    const replyMsg = env.getReplyMessage(item.reply_to);
    const isVideoRenderable = isVideoMessage
      ? listExtra.renderableVideoIds?.has(item.id)
      : false;
    const messageRowAnims = env.ensureMessageAnims(item.id);
    const isEphemeral = !!item.expires_at;
    const isEdited = !!item.edited_at;
    const isSelected = listExtra.selectionMode && env.selectedIds.has(item.id);
    const { bounceAnim, bounceAnimVideo } = useMessageRowSelectionBounce(isSelected);

    const rowMarginBottom = item._abovePlayerName != null ? 4 : 0;
    const bubbleMaxW = env.windowWidth * 0.75;
    const ariaImageMaxW = env.windowWidth - 24;
    const rowEdgePadTw = listExtra.ariaPlainPanel ? '' : 'px-4';
    const bubbleRadii = getMessageBubbleRadii(isMine);
    const ariaPanelUserAsIncoming = listExtra.ariaPlainPanel && isMine;
    const textSelectable = !!listExtra.ariaPlainPanel;
    const bubbleSwipeEnabled = !listExtra.selectionMode && !listExtra.ariaPlainPanel;
    const useAriaLinks = listExtra.isAriaChat && !item.aria_voice_message;
    const ariaGeneratedAttachment =
      listExtra.isAriaChat && item.aria_attachment && !isAriaTyping ? item.aria_attachment : null;
    const hasAriaImageAttachment = String(
      ariaGeneratedAttachment?.mime_type || '',
    ).startsWith('image/');

    const hasReactions =
      !listExtra.isAriaChat &&
      item.reactions &&
      Object.keys(item.reactions).length > 0;
    const bubbleAnchorStyle = {
      position: 'relative',
      alignSelf: isMine ? 'flex-end' : 'flex-start',
      maxWidth: '100%',
      ...(hasReactions && !isVideoMessage
        ? { marginBottom: REACTION_OVERLAY_ROW_RESERVE }
        : {}),
    };
    const reactionsBar = !listExtra.isAriaChat ? (
      <ChatReactionsBar
        reactions={item.reactions}
        onReact={(emoji) =>
          listExtra.selectionMode
            ? onMessagePress(undefined, item)
            : env.toggleReaction(item.id, emoji)
        }
      />
    ) : null;

    const bubbleInner = (
      <MessageRowBubbleInner
        rowKind={rowKind}
        item={item}
        isMine={isMine}
        isEphemeral={isEphemeral}
        isEdited={isEdited}
        isSelected={isSelected}
        ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
        textSelectable={textSelectable}
        useAriaLinks={useAriaLinks}
        replyMsg={replyMsg}
        env={env}
        listExtra={listExtra}
        isVideoRenderable={isVideoRenderable}
        reactionsBar={reactionsBar}
        bounceAnimVideo={bounceAnimVideo}
        hasReactions={hasReactions}
        bubbleMaxW={bubbleMaxW}
        onMessagePress={onMessagePress}
        handleMessagePress={handleMessagePress}
        onDoubleTapHeart={fireHeartReaction}
        onLongPress={emitMessageLongPress}
      />
    );

    const dateSeparatorEl = item._showDate ? (
      <ChatDateSeparator
        label={item._dateLabel}
        withTopGap={index < listLength - 1}
        onPress={
          env.onDateSeparatorPress
            ? (anchor) => env.onDateSeparatorPress(anchor, item._dateKey, item._dateLabel)
            : undefined
        }
      />
    ) : null;

    if (rowKind === 'ariaPlainTyping' || rowKind === 'ariaPlainText') {
      return (
        <MessageRowAriaPlain
          kind={rowKind}
          item={item}
          index={index}
          rowMarginBottom={rowMarginBottom}
          dateSeparatorEl={dateSeparatorEl}
          messageRowAnims={messageRowAnims}
          useAriaLinks={useAriaLinks}
          textSelectable={textSelectable}
          ariaGeneratedAttachment={ariaGeneratedAttachment}
          ariaImageMaxW={ariaImageMaxW}
          bubbleMaxW={bubbleMaxW}
          env={env}
        />
      );
    }

    return (
      <MessageRowBubbleChrome
        rowKind={rowKind}
        item={item}
        index={index}
        rowMarginBottom={rowMarginBottom}
        dateSeparatorEl={dateSeparatorEl}
        messageRowAnims={messageRowAnims}
        rowEdgePadTw={rowEdgePadTw}
        isSelected={isSelected}
        isMine={isMine}
        bubbleMaxW={bubbleMaxW}
        bubbleRadii={bubbleRadii}
        bubbleAnchorStyle={bubbleAnchorStyle}
        bubbleSwipeEnabled={bubbleSwipeEnabled}
        bubbleInner={bubbleInner}
        reactionsBar={reactionsBar}
        fireReply={fireReply}
        handleMessagePress={handleMessagePress}
        emitMessageLongPress={emitMessageLongPress}
        textSelectable={textSelectable}
        bounceAnim={bounceAnim}
        listExtra={listExtra}
        isEphemeral={isEphemeral}
        hasAriaImageAttachment={hasAriaImageAttachment}
        ariaGeneratedAttachment={ariaGeneratedAttachment}
        ariaImageMaxW={ariaImageMaxW}
        env={env}
      />
    );
  },
  messageRowPropsAreEqual,
);

export default MessageRow;
