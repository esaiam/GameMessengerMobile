import React, { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, Animated, Pressable } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';
import { Mic } from '../../icons/lucideIcons';
import OutgoingBubble from './OutgoingBubble';
import BubbleMaterial from './BubbleMaterial';
import ChatReplyPreview from './ChatReplyPreview';
import ChatVideoPlaceholder from './ChatVideoPlaceholder';
import ChatEphemeralCountdown from './ChatEphemeralCountdown';
import ChatReadCheck from './ChatReadCheck';
import ChatReactionsBar from './ChatReactionsBar';
import ChatDateSeparator from './ChatDateSeparator';
import ChatImageMessage from './ChatImageMessage';
import MessageBubbleSwipeWrap from './MessageBubbleSwipeWrap';
import { ARIA_MESSAGE_TYPING } from '../../lib/aria';
import { isGifMediaUrl } from '../../lib/isGifMediaUrl';
import { AriaTypingDots } from './AriaChatUi';
import AriaGeneratedAttachment from './AriaGeneratedAttachment';
import { LinkifyMessageText } from './linkifyMessageText';
import {
  MESSAGE_ROW_SELECTION_BG,
  BUBBLE_RADIUS,
  BUBBLE_TAIL,
  MSG_TEXT_SIZE,
  MSG_LINE_HEIGHT,
  TS_TEXT_SIZE,
  META_RESERVE_PX_INCOMING,
  META_RESERVE_PX_OUTGOING,
  META_RESERVE_PX_EPHEMERAL_EXTRA,
  VIDEO_FEED_CIRCLE_IDLE,
  REACTION_OVERLAY_ROW_RESERVE } from './messageBubbleLayoutConstants';

const HEART_REACTION_EMOJI = '❤️';
const DOUBLE_TAP_DELAY_MS = 200;

/** Снимок координат до recycle synthetic event (single-tap откладывается на DOUBLE_TAP_DELAY_MS). */
function snapshotPressEvent(event) {
  const x = event?.nativeEvent?.pageX ?? 0;
  const y = event?.nativeEvent?.pageY ?? 0;
  return { nativeEvent: { pageX: x, pageY: y } };
}

/** Одиночный тап — отложенно; второй в окне — double (без срабатывания single). */
function useDoubleTapPress(onSingleTap, onDoubleTap) {
  const lastTapAtRef = useRef(0);
  const pendingSingleRef = useRef(null);

  useEffect(
    () => () => {
      if (pendingSingleRef.current != null) {
        clearTimeout(pendingSingleRef.current);
        pendingSingleRef.current = null;
      }
    },
    [],
  );

  return useCallback(
    (event) => {
      const pressSnapshot = snapshotPressEvent(event);
      const now = Date.now();
      if (now - lastTapAtRef.current < DOUBLE_TAP_DELAY_MS) {
        if (pendingSingleRef.current != null) {
          clearTimeout(pendingSingleRef.current);
          pendingSingleRef.current = null;
        }
        lastTapAtRef.current = 0;
        onDoubleTap(pressSnapshot);
        return;
      }
      lastTapAtRef.current = now;
      if (pendingSingleRef.current != null) {
        clearTimeout(pendingSingleRef.current);
      }
      pendingSingleRef.current = setTimeout(() => {
        pendingSingleRef.current = null;
        onSingleTap(pressSnapshot);
      }, DOUBLE_TAP_DELAY_MS);
    },
    [onSingleTap, onDoubleTap],
  );
}

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
    const handleImagePress = useDoubleTapPress(
      (e) => {
        if (listExtra.selectionMode) onMessagePress(e, item);
        else env.setFullScreenImage?.(item.media_url);
      },
      fireHeartReaction,
    );
    const isMine = item.player_name === env.nickname;
    const replyMsg = env.getReplyMessage(item.reply_to);
    const isVideoMessage = item.message_type === 'video';
    const isImageMessage = item.message_type === 'image';
    const isAriaTyping =
      item.message_type === ARIA_MESSAGE_TYPING || item.isTyping === true;
    const isVideoRenderable = isVideoMessage
      ? listExtra.renderableVideoIds?.has(item.id)
      : false;
    const messageRowAnims = env.ensureMessageAnims(item.id);
    const isEphemeral = !!item.expires_at;
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

    /** Голос Aria с локальным файлом — плеер + опционально транскрипт (иначе старый Mic+текст). */
    const isAriaVoiceBubble =
      item.aria_voice_message === true && !!item.audio_uri;
    const isTextMessage =
      !isAriaTyping &&
      !isAriaVoiceBubble &&
      (item.aria_voice_message === true ||
        !item.message_type ||
        item.message_type === 'text');
    const textTimeColor = isMine ? V.outBubbleTime : V.inBubbleTime;
    const textBodyColor = isMine ? V.outBubbleText : V.inBubbleText;
    const legacyTimeColor = isMine
      ? 'rgba(186, 222, 218, 0.52)'
      : 'rgba(168, 162, 152, 0.58)';
    const ariaTextBodyStyle = {
      fontSize: MSG_TEXT_SIZE,
      fontWeight: '400',
      lineHeight: MSG_LINE_HEIGHT,
      color: textBodyColor };
    /** Aria: plain text + кликабельные URL, без markdown-оформления. */
    const useAriaLinks = listExtra.isAriaChat && !item.aria_voice_message;
    const ariaGeneratedAttachment =
      listExtra.isAriaChat && item.aria_attachment && !isAriaTyping ? item.aria_attachment : null;
    const hasAriaImageAttachment = String(
      ariaGeneratedAttachment?.mime_type || '',
    ).startsWith('image/');

    const renderTimeMeta = (timeColor) => (
      <>
        {isEphemeral && <ChatEphemeralCountdown expiresAt={item.expires_at} />}
        <Text style={{ fontSize: TS_TEXT_SIZE, color: timeColor, fontWeight: '400' }}>
          {item._formattedTime}
        </Text>
        <ChatReadCheck isRead={!!item.read_at} isMine={isMine} />
      </>
    );
    const textTimeMeta = renderTimeMeta(textTimeColor);
    const legacyTimeMeta = renderTimeMeta(legacyTimeColor);

    const metaReservePx =
      (isMine ? META_RESERVE_PX_OUTGOING : META_RESERVE_PX_INCOMING) +
      (isEphemeral ? META_RESERVE_PX_EPHEMERAL_EXTRA : 0);

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
    const videoCircleAnchorStyle = {
      position: 'relative',
      alignSelf: 'flex-start',
      ...(hasReactions && isVideoMessage
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

    const videoEdgeStripStyle = { flex: 1, alignSelf: 'stretch' };
    /* Клип круга — только внутри VideoMessage (Animated.View + overflow: hidden). Здесь без overflow: hidden — иначе предок expo-video ломает композицию вместе с нативным драйвером на строке. */
    const videoCircleChrome = {
      borderRadius: VIDEO_FEED_CIRCLE_IDLE / 2,
      ...(isEphemeral ? { borderWidth: 0.5, borderColor: V.accentGold } : {}) };
    const videoCircleNode = (
      <View style={videoCircleAnchorStyle}>
        <Animated.View style={{ transform: [{ scale: bounceAnimVideo }] }}>
          <View style={{ ...videoCircleChrome, alignSelf: 'flex-start' }}>
            {isVideoRenderable
              ? env.renderMessageContent(item, isMine)
              : (
                <ChatVideoPlaceholder
                  isUploading={item._isOptimistic === true}
                  onPress={() => listExtra.onUnlockVideo?.(item.id)}
                />
              )}
          </View>
        </Animated.View>
        {reactionsBar}
      </View>
    );
    const videoTimeOverlayStyle = {
      position: 'absolute',
      bottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      zIndex: 10,
      ...(isMine ? { right: 8 } : { left: 8 }) };

    const bubbleInner = isTextMessage ? (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        <View style={{ overflow: 'visible', paddingRight: metaReservePx }}>
          {item.aria_voice_message && !item.audio_uri ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 6,
                alignSelf: 'flex-start',
                maxWidth: '100%' }}
            >
              <Mic
                size={16}
                color={V.accentSage}
                strokeWidth={1.5}
                style={{ marginTop: 2 }}
              />
              <Text
                style={{
                  flexShrink: 1,
                  fontSize: MSG_TEXT_SIZE,
                  fontWeight: '400',
                  lineHeight: MSG_LINE_HEIGHT,
                  color: textBodyColor}}
              >
                {item.text}
              </Text>
            </View>
          ) : useAriaLinks ? (
            <LinkifyMessageText text={item.text} style={ariaTextBodyStyle} />
          ) : (
            <Text style={ariaTextBodyStyle}>{item.text}</Text>
          )}
          <View
            style={{
              position: 'absolute',
              right: -5,
              bottom: 2,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2 }}
          >
            {textTimeMeta}
          </View>
        </View>
      </>
    ) : isVideoMessage ? (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        <View style={{ position: 'relative', width: '100%', alignSelf: 'stretch' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'stretch',
              width: '100%',
              alignSelf: 'stretch' }}
          >
            {isMine ? (
              <>
                <View style={videoEdgeStripStyle} />
                {videoCircleNode}
              </>
            ) : (
              <>
                {videoCircleNode}
                <View style={videoEdgeStripStyle} />
              </>
            )}
          </View>
          <View style={videoTimeOverlayStyle} pointerEvents="none">
            {legacyTimeMeta}
          </View>
        </View>
      </>
    ) : isAriaVoiceBubble ? (
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
          >
            {item.transcription}
          </Text>
        ) : null}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          {legacyTimeMeta}
        </View>
      </>
    ) : isImageMessage ? (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        <View style={imageRowStyles.row}>
          {isMine ? <View style={imageRowStyles.chromeHit} /> : null}
          <ChatImageMessage
            uri={item.media_url}
            caption={item.text}
            formattedTime={item._formattedTime}
            isRead={!!item.read_at}
            isMine={isMine}
            isGif={isGifMediaUrl(item.media_url)}
            layoutMaxWidth={
              isGifMediaUrl(item.media_url)
                ? Math.floor(env.windowWidth * 0.86)
                : bubbleMaxW
            }
            isEphemeral={isEphemeral}
            expiresAt={item.expires_at}
            isSelected={isSelected}
            onPress={handleImagePress}
            onCaptionPress={handleMessagePress}
            onLongPress={emitMessageLongPress}
          />
          {!isMine ? <View style={imageRowStyles.chromeHit} /> : null}
        </View>
      </>
    ) : (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(item, isMine)}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          {legacyTimeMeta}
        </View>
      </>
    );

    return (
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {item._showDate && (
          <ChatDateSeparator
            label={item._dateLabel}
            withTopGap={index < listLength - 1}
            onPress={
              env.onDateSeparatorPress
                ? (anchor) => env.onDateSeparatorPress(anchor, item._dateKey, item._dateLabel)
                : undefined
            }
          />
        )}
        {isAriaTyping ? (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }] }}
          >
            <View
              style={[
                tw`flex-row items-end px-4`,
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
        ) : isVideoMessage || isImageMessage ? (
          <Pressable
            onPress={handleMessagePress}
            onLongPress={emitMessageLongPress}
            delayLongPress={400}
            style={{ width: '100%' }}
          >
            <View
              style={[
                tw`${isMine ? 'items-end' : 'items-start'} px-4`,
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
                  enabled={!listExtra.selectionMode}
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
                {isImageMessage ? reactionsBar : null}
              </View>
            </View>
          </Pressable>
        ) : (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }] }}
          >
            <Pressable
              onPress={handleMessagePress}
              onLongPress={emitMessageLongPress}
              delayLongPress={400}
              style={{ width: '100%' }}
            >
              <View
                style={[
                  tw`${isMine ? 'items-end' : 'items-start'} px-4`,
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
                        enabled={!listExtra.selectionMode}
                        isMine={isMine}
                        onReply={fireReply}
                      >
                        {isImageMessage ? (
                          <View style={{ alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                            {bubbleInner}
                          </View>
                        ) : isMine ? (
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
                            alignSelf="flex-start"
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
            </Pressable>
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

/** Зона «рядом с фото» — тап открывает меню; flex забирает пустое место в строке */
const imageRowStyles = {
  row: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-end',
    minHeight: 44 },
  chromeHit: {
    flex: 1,
    alignSelf: 'stretch' } };

export default MessageRow;
