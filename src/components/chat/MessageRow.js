import React, { useCallback, useEffect, useRef } from 'react';
import { useDoubleTapPress } from './messageRow/useDoubleTapPress';
import * as Haptics from 'expo-haptics';
import { View, Text, Animated, Pressable } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';
import OutgoingBubble from './OutgoingBubble';
import BubbleMaterial from './BubbleMaterial';
import ChatReplyPreview from './ChatReplyPreview';
import ChatReactionsBar from './ChatReactionsBar';
import ChatDateSeparator from './ChatDateSeparator';
import { deriveMessageRowFlags, resolveMessageRowKind } from './messageRow/deriveMessageRowKind';
import MessageRowTimeMeta from './messageRow/MessageRowTimeMeta';
import MessageRowVideoContent from './messageRow/MessageRowVideoContent';
import MessageRowImageContent from './messageRow/MessageRowImageContent';
import MessageRowTextBubbleInner from './messageRow/MessageRowTextBubbleInner';
import MessageRowAriaPlain from './messageRow/MessageRowAriaPlain';
import MessageBubbleSwipeWrap from './MessageBubbleSwipeWrap';
import { AriaTypingDots } from './AriaChatUi';
import AriaGeneratedAttachment from './AriaGeneratedAttachment';
import {
  MESSAGE_ROW_SELECTION_BG,
  BUBBLE_RADIUS,
  BUBBLE_TAIL,
  MSG_TEXT_SIZE,
  MSG_LINE_HEIGHT,
  REACTION_OVERLAY_ROW_RESERVE } from './messageBubbleLayoutConstants';

const HEART_REACTION_EMOJI = '❤️';

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
    onMessageLongPress }) {
    const env = rowEnvRef.current;
    const listLength = fmtLenRef.current;
    const rowFlags = deriveMessageRowFlags(item, listExtra, env);
    const rowKind = resolveMessageRowKind(rowFlags);
    const {
      isMine,
      isVideoMessage,
      isAriaTyping,
    } = rowFlags;
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

    const bounceAnim = useRef(new Animated.Value(1)).current;
    const bounceAnimVideo = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (isSelected) {
        bounceAnim.setValue(1.04);
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: true }).start();
        bounceAnimVideo.setValue(1.04);
        Animated.spring(bounceAnimVideo, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: false }).start();
      }
    }, [isSelected, bounceAnim, bounceAnimVideo]);

    let rowMarginBottom = 0;
    if (item._abovePlayerName != null) {
      rowMarginBottom = 4;
    }

    const bubbleMaxW = env.windowWidth * 0.75;
    const ariaImageMaxW = env.windowWidth - 24;
    /** В панели Aria горизонталь только у contentContainer списка (16px). */
    const rowEdgePadTw = listExtra.ariaPlainPanel ? '' : 'px-4';

    const bubbleRadii = isMine
      ? {
          borderTopLeftRadius: BUBBLE_RADIUS,
          borderTopRightRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: BUBBLE_RADIUS,
          borderBottomRightRadius: BUBBLE_TAIL }
      : {
          borderTopLeftRadius: BUBBLE_RADIUS,
          borderTopRightRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: BUBBLE_TAIL,
          borderBottomRightRadius: BUBBLE_RADIUS };

    /** В панели Aria исходящие — тот же chrome, что входящие в обычном чате. */
    const ariaPanelUserAsIncoming = listExtra.ariaPlainPanel && isMine;
    /** В панели Aria — выделение и копирование текста. */
    const textSelectable = !!listExtra.ariaPlainPanel;
    const bubbleSwipeEnabled = !listExtra.selectionMode && !listExtra.ariaPlainPanel;
    const TextMessageWrapper = textSelectable ? View : Pressable;
    const textMessageWrapperProps = textSelectable
      ? { style: { width: '100%' } }
      : {
          onPress: handleMessagePress,
          onLongPress: emitMessageLongPress,
          delayLongPress: 400,
          style: { width: '100%' },
        };
    /** Aria: plain text + кликабельные URL, без markdown-оформления. */
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
        : {}) };
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

    const bubbleInner = rowKind === 'text' ? (
      <MessageRowTextBubbleInner
        item={item}
        isMine={isMine}
        isEphemeral={isEphemeral}
        isEdited={isEdited}
        ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
        textSelectable={textSelectable}
        useAriaLinks={useAriaLinks}
        replyMsg={replyMsg}
      />
    ) : rowKind === 'video' ? (
      <MessageRowVideoContent
        item={item}
        isMine={isMine}
        isVideoRenderable={isVideoRenderable}
        isEphemeral={isEphemeral}
        listExtra={listExtra}
        env={env}
        replyMsg={replyMsg}
        reactionsBar={reactionsBar}
        bounceAnimVideo={bounceAnimVideo}
        ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
        hasReactions={hasReactions}
      />
    ) : rowKind === 'ariaVoice' ? (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(
          {
            ...item,
            message_type: 'voice',
            media_url: item.audio_uri },
          isMine
        )}
        {item.transcription != null ? (
          <Text
            style={{
              marginTop: 6,
              fontSize: MSG_TEXT_SIZE,
              fontWeight: '400',
              lineHeight: MSG_LINE_HEIGHT,
              fontStyle: 'italic',
              color: V.textSecondary}}
            selectable={textSelectable}
          >
            {item.transcription}
          </Text>
        ) : null}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          <MessageRowTimeMeta
            item={item}
            isMine={isMine}
            ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
            variant="legacy"
          />
        </View>
      </>
    ) : rowKind === 'image' ? (
      <MessageRowImageContent
        item={item}
        isMine={isMine}
        bubbleMaxW={bubbleMaxW}
        windowWidth={env.windowWidth}
        isEphemeral={isEphemeral}
        isSelected={isSelected}
        listExtra={listExtra}
        env={env}
        replyMsg={replyMsg}
        onMessagePress={onMessagePress}
        onCaptionPress={handleMessagePress}
        onDoubleTapHeart={fireHeartReaction}
        onLongPress={emitMessageLongPress}
      />
    ) : (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(item, isMine)}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          <MessageRowTimeMeta
            item={item}
            isMine={isMine}
            ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
            variant="legacy"
          />
        </View>
      </>
    );

    const dateSeparatorEl =
      item._showDate ? (
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
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {dateSeparatorEl}
        {rowKind === 'typing' ? (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }] }}
          >
            <View
              style={[
                tw`flex-row items-end ${rowEdgePadTw}`,
                isSelected && {backgroundColor: MESSAGE_ROW_SELECTION_BG}]}
            >
              <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    marginBottom: 3,
                    marginLeft: 4,
                    color: V.accentSage}}
                  numberOfLines={1}
                >
                  {item.player_name}
                </Text>
                <MessageBubbleSwipeWrap enabled={false} isMine={false} onReply={fireReply}>
                  <BubbleMaterial
                    bubbleMaxW={bubbleMaxW}
                    alignSelf="flex-start"
                    bubbleRadii={bubbleRadii}
                    isEphemeral={false}
                    selectionMode={false}
                  >
                    <AriaTypingDots />
                  </BubbleMaterial>
                </MessageBubbleSwipeWrap>
              </View>
            </View>
          </Animated.View>
        ) : rowKind === 'video' || rowKind === 'image' ? (
          <Pressable
            onPress={handleMessagePress}
            onLongPress={emitMessageLongPress}
            delayLongPress={400}
            style={{ width: '100%' }}
          >
            <View
              style={[
                tw`${isMine ? 'items-end' : 'items-start'} ${rowEdgePadTw}`,
                isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG }]}
            >
              {!isMine && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    marginBottom: 3,
                    marginLeft: 4,
                    color: V.accentSage}}
                  numberOfLines={1}
                >
                  {item.player_name}
                </Text>
              )}
              <View style={bubbleAnchorStyle}>
                <MessageBubbleSwipeWrap
                  enabled={bubbleSwipeEnabled}
                  isMine={isMine}
                  onReply={fireReply}
                >
                  <View
                    style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '100%' }}
                  >
                    {bubbleInner}
                  </View>
                </MessageBubbleSwipeWrap>
                {rowKind === 'image' ? reactionsBar : null}
              </View>
            </View>
          </Pressable>
        ) : (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }] }}
          >
            <TextMessageWrapper {...textMessageWrapperProps}>
              <View
                style={[
                  tw`${isMine ? 'items-end' : 'items-start'} ${rowEdgePadTw}`,
                  isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG }]}
              >
                <View
                  style={{
                    alignSelf: isMine ? 'stretch' : 'flex-start',
                    width: isMine ? '100%' : undefined }}
                >
                  {!isMine && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        marginBottom: 3,
                        marginLeft: 4,
                        color: V.accentSage}}
                      numberOfLines={1}
                    >
                      {item.player_name}
                    </Text>
                  )}
                  <View style={bubbleAnchorStyle}>
                    <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
                      <MessageBubbleSwipeWrap
                        enabled={bubbleSwipeEnabled}
                        isMine={isMine}
                        onReply={fireReply}
                      >
                        {isMine && !listExtra.ariaPlainPanel ? (
                          <OutgoingBubble
                            message={item}
                            bubbleMaxW={bubbleMaxW}
                            bubbleRadii={bubbleRadii}
                            isEphemeral={isEphemeral}
                            isSelected={false}
                            selectionMode={listExtra.selectionMode}
                            noPaddingBottom={hasAriaImageAttachment}
                          >
                            {bubbleInner}
                          </OutgoingBubble>
                        ) : (
                          <BubbleMaterial
                            bubbleMaxW={bubbleMaxW}
                            alignSelf={isMine ? 'flex-end' : 'flex-start'}
                            bubbleRadii={bubbleRadii}
                            isEphemeral={isEphemeral}
                            selectionMode={listExtra.selectionMode}
                            noPaddingBottom={hasAriaImageAttachment}
                          >
                            {bubbleInner}
                          </BubbleMaterial>
                        )}
                      </MessageBubbleSwipeWrap>
                    </Animated.View>
                    {reactionsBar}
                  </View>
                  {ariaGeneratedAttachment ? (
                    <View style={{ marginTop: 6, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                      <AriaGeneratedAttachment
                        attachment={ariaGeneratedAttachment}
                        layoutMaxWidth={ariaGeneratedAttachment?.mime_type === 'image/png' 
                          ? ariaImageMaxW 
                          : bubbleMaxW}
                        formattedTime={item._formattedTime}
                        isRead={!!item.read_at}
                        isMine={isMine}
                        onImagePress={(uri) => env.setFullScreenImage?.(uri)}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </TextMessageWrapper>
          </Animated.View>
        )}
      </View>
    );
  },
  (prev, next) => {
    const isVoiceOrAudio = (item) =>
      item?.message_type === 'voice' ||
      item?.message_type === 'audio' ||
      (item?.aria_voice_message === true && !!item?.audio_uri);

    if (isVoiceOrAudio(prev.item)) {
      const prevIsActive = prev.activeVoiceMessageId === prev.item.id;
      const nextIsActive = next.activeVoiceMessageId === next.item.id;
      // Если этот пузырь сейчас активен или становится активным — перерендер
      if (prevIsActive || nextIsActive) {
        return (
          prev.voicePlaybackSig === next.voicePlaybackSig &&
          prev.activeVoiceUri === next.activeVoiceUri &&
          prev.isRecordingVoice === next.isRecordingVoice
        );
      }
      // Неактивная голосовая строка: item стабилен, но смена URI/id плеера должна снимать залипший прогресс
      return (
        prev.item === next.item &&
        prev.index === next.index &&
        prev.listExtra === next.listExtra &&
        prev.activeVoiceUri === next.activeVoiceUri &&
        prev.activeVoiceMessageId === next.activeVoiceMessageId
      );
    }

    if (prev.item.message_type === 'video') {
      const prevIsActive = prev.activeVideoId === prev.item.id;
      const nextIsActive = next.activeVideoId === next.item.id;
      // Перерендер только если этот конкретный пузырь стал активным или перестал
      if (prevIsActive !== nextIsActive) return false;
    }

    return (
      prev.item === next.item &&
      prev.index === next.index &&
      prev.listExtra === next.listExtra
    );
  }
);

export default MessageRow;
