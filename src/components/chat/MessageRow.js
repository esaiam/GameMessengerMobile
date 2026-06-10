import React, { useCallback, useEffect, useRef } from 'react';
import { useDoubleTapPress } from './messageRow/useDoubleTapPress';
import * as Haptics from 'expo-haptics';
import { View, Text, Animated, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native';
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
        else env.setFullScreenImage?.({ uris: [item.media_url], index: 0 });
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

    /** Голос Aria с локальным файлом — плеер + опционально транскрипт (иначе старый Mic+текст). */
    const isAriaVoiceBubble =
      item.aria_voice_message === true && !!item.audio_uri;
    const isTextMessage =
      !isAriaTyping &&
      !isAriaVoiceBubble &&
      (item.aria_voice_message === true ||
        !item.message_type ||
        item.message_type === 'text');
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
    const textTimeColor =
      isMine && !ariaPanelUserAsIncoming ? V.outBubbleTime : V.inBubbleTime;
    const textBodyColor =
      isMine && !ariaPanelUserAsIncoming ? V.outBubbleText : V.inBubbleText;
    const legacyTimeColor =
      isMine && !ariaPanelUserAsIncoming
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
        {isEdited ? (
          <Text style={{ fontSize: TS_TEXT_SIZE - 1, color: timeColor, fontWeight: '400' }}>
            изм.
          </Text>
        ) : null}
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
      (isEphemeral ? META_RESERVE_PX_EPHEMERAL_EXTRA : 0) +
      (isEdited ? 24 : 0);

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
                selectable={textSelectable}
              >
                {item.text}
              </Text>
            </View>
          ) : useAriaLinks ? (
            <LinkifyMessageText
              text={item.text}
              style={ariaTextBodyStyle}
              selectable={textSelectable}
            />
          ) : (
            <Text style={ariaTextBodyStyle} selectable={textSelectable}>
              {item.text}
            </Text>
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
            selectable={textSelectable}
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
          {Array.isArray(item.media_urls) && item.media_urls.length > 1 ? (
            <ChatMultiImageGrid
              urls={item.media_urls}
              caption={item.text}
              layoutMaxWidth={bubbleMaxW}
              formattedTime={item._formattedTime}
              isRead={!!item.read_at}
              isMine={isMine}
              isEphemeral={isEphemeral}
              expiresAt={item.expires_at}
              isSelected={isSelected}
              isUploading={item._isOptimistic === true}
              selectionMode={listExtra.selectionMode}
              item={item}
              onMessagePress={onMessagePress}
              onOpenImage={(i) => env.setFullScreenImage?.({ uris: item.media_urls, index: i })}
              onDoubleTapHeart={fireHeartReaction}
              onCaptionPress={handleMessagePress}
              onLongPress={emitMessageLongPress}
            />
          ) : (
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
              isUploading={item._isOptimistic === true}
              onPress={handleImagePress}
              onCaptionPress={handleMessagePress}
              onLongPress={emitMessageLongPress}
            />
          )}
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

    const ariaPlainIncoming = listExtra.ariaPlainPanel && !isMine;
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

    if (ariaPlainIncoming && isAriaTyping) {
      return (
        <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
          {dateSeparatorEl}
          <View style={{ paddingVertical: 8, alignItems: 'flex-start' }}>
            <AriaTypingDots />
          </View>
        </View>
      );
    }

    if (ariaPlainIncoming && isTextMessage && !isAriaVoiceBubble) {
      const plainBodyStyle = {
        fontSize: MSG_TEXT_SIZE,
        fontWeight: '400',
        lineHeight: MSG_LINE_HEIGHT,
        color: V.textPrimary,
      };
      return (
        <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
          {dateSeparatorEl}
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }],
            }}
          >
            <View style={{ paddingVertical: 8, alignItems: 'flex-start', maxWidth: '100%' }}>
              {useAriaLinks ? (
                <LinkifyMessageText
                  text={item.text}
                  style={plainBodyStyle}
                  selectable={textSelectable}
                />
              ) : (
                <Text style={plainBodyStyle} selectable={textSelectable}>
                  {item.text}
                </Text>
              )}
              {ariaGeneratedAttachment ? (
                <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <AriaGeneratedAttachment
                    attachment={ariaGeneratedAttachment}
                    layoutMaxWidth={
                      ariaGeneratedAttachment?.mime_type === 'image/png'
                        ? ariaImageMaxW
                        : bubbleMaxW
                    }
                    formattedTime={item._formattedTime}
                    isRead={!!item.read_at}
                    isMine={false}
                    onImagePress={(uri) => env.setFullScreenImage?.(uri)}
                  />
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      );
    }

    return (
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {dateSeparatorEl}
        {isAriaTyping ? (
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
        ) : isVideoMessage || isImageMessage ? (
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

const GRID_GAP = 2;
const GRID_RADIUS = 8;

function ChatMultiImageGridCell({
  uri,
  imageIndex,
  width,
  height,
  borderRadii,
  showMoreOverlay,
  moreCount,
  selectionMode,
  item,
  onMessagePress,
  onOpenImage,
  onDoubleTapHeart,
  onLongPress,
}) {
  const handlePress = useDoubleTapPress(
    (e) => {
      if (selectionMode) onMessagePress(e, item);
      else onOpenImage(imageIndex);
    },
    onDoubleTapHeart,
  );

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        multiImageGridStyles.cell,
        { width, height },
        borderRadii,
        pressed && multiImageGridStyles.cellPressed,
      ]}
    >
      <Image source={{ uri }} style={multiImageGridStyles.cellImage} resizeMode="cover" />
      {showMoreOverlay ? (
        <View pointerEvents="none" style={multiImageGridStyles.moreOverlay}>
          <Text style={multiImageGridStyles.moreOverlayText}>+{moreCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ChatMultiImageGrid({
  urls,
  caption,
  layoutMaxWidth,
  formattedTime,
  isRead,
  isMine,
  isEphemeral,
  expiresAt,
  isSelected,
  isUploading,
  selectionMode,
  item,
  onMessagePress,
  onOpenImage,
  onDoubleTapHeart,
  onCaptionPress,
  onLongPress,
}) {
  const hasCaption = Boolean(String(caption || '').trim());
  const gridW = Math.floor(layoutMaxWidth);
  const half = (gridW - GRID_GAP) / 2;
  const count = urls.length;
  const R = GRID_RADIUS;

  const cellProps = {
    selectionMode,
    item,
    onMessagePress,
    onOpenImage,
    onDoubleTapHeart,
    onLongPress,
  };

  let gridBody = null;

  if (count === 2) {
    gridBody = (
      <View style={[multiImageGridStyles.row, { width: gridW }]}>
        <ChatMultiImageGridCell
          uri={urls[0]}
          imageIndex={0}
          width={half}
          height={half}
          borderRadii={{ borderTopLeftRadius: R, borderBottomLeftRadius: R }}
          {...cellProps}
        />
        <ChatMultiImageGridCell
          uri={urls[1]}
          imageIndex={1}
          width={half}
          height={half}
          borderRadii={{ borderTopRightRadius: R, borderBottomRightRadius: R }}
          {...cellProps}
        />
      </View>
    );
  } else if (count === 3) {
    gridBody = (
      <View style={{ width: gridW, gap: GRID_GAP }}>
        <ChatMultiImageGridCell
          uri={urls[0]}
          imageIndex={0}
          width={gridW}
          height={half}
          borderRadii={{ borderTopLeftRadius: R, borderTopRightRadius: R }}
          {...cellProps}
        />
        <View style={multiImageGridStyles.row}>
          <ChatMultiImageGridCell
            uri={urls[1]}
            imageIndex={1}
            width={half}
            height={half}
            borderRadii={{ borderBottomLeftRadius: R }}
            {...cellProps}
          />
          <ChatMultiImageGridCell
            uri={urls[2]}
            imageIndex={2}
            width={half}
            height={half}
            borderRadii={{ borderBottomRightRadius: R }}
            {...cellProps}
          />
        </View>
      </View>
    );
  } else {
    const visible = urls.slice(0, 4);
    const extraCount = count - 4;
    gridBody = (
      <View style={{ width: gridW, gap: GRID_GAP }}>
        <View style={multiImageGridStyles.row}>
          <ChatMultiImageGridCell
            uri={visible[0]}
            imageIndex={0}
            width={half}
            height={half}
            borderRadii={{ borderTopLeftRadius: R }}
            {...cellProps}
          />
          <ChatMultiImageGridCell
            uri={visible[1]}
            imageIndex={1}
            width={half}
            height={half}
            borderRadii={{ borderTopRightRadius: R }}
            {...cellProps}
          />
        </View>
        <View style={multiImageGridStyles.row}>
          <ChatMultiImageGridCell
            uri={visible[2]}
            imageIndex={2}
            width={half}
            height={half}
            borderRadii={{ borderBottomLeftRadius: R }}
            {...cellProps}
          />
          <ChatMultiImageGridCell
            uri={visible[3]}
            imageIndex={3}
            width={half}
            height={half}
            borderRadii={{ borderBottomRightRadius: R }}
            showMoreOverlay={extraCount > 0}
            moreCount={extraCount}
            {...cellProps}
          />
        </View>
      </View>
    );
  }

  const wrapPress = (child, pressHandler) => {
    if (!pressHandler && !onLongPress) return child;
    return (
      <Pressable
        onPress={pressHandler}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => (pressed ? multiImageGridStyles.cellPressed : null)}
      >
        {child}
      </Pressable>
    );
  };

  return (
    <View style={{ maxWidth: gridW, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
      <View
        style={[
          multiImageGridStyles.gridWrap,
          { width: gridW },
          isEphemeral && multiImageGridStyles.gridWrapEphemeral,
          isSelected && multiImageGridStyles.gridWrapSelected,
        ]}
      >
        {gridBody}
        {isUploading ? (
          <View pointerEvents="none" style={multiImageGridStyles.uploadOverlay}>
            <ActivityIndicator color={V.accentSage} size="small" />
          </View>
        ) : null}
        <View pointerEvents="none" style={multiImageGridStyles.metaOverlay}>
          {isEphemeral ? <ChatEphemeralCountdown expiresAt={expiresAt} /> : null}
          <Text style={multiImageGridStyles.timeText}>{formattedTime}</Text>
          <ChatReadCheck isRead={isRead} isMine={isMine} variant="overlay" />
        </View>
      </View>
      {hasCaption
        ? wrapPress(
            <View
              style={[
                multiImageGridStyles.captionBox,
                { maxWidth: gridW },
                isMine ? multiImageGridStyles.captionBoxMine : multiImageGridStyles.captionBoxTheir,
                isEphemeral && multiImageGridStyles.gridWrapEphemeral,
                isSelected && multiImageGridStyles.gridWrapSelected,
              ]}
            >
              <Text
                style={{
                  fontSize: MSG_TEXT_SIZE,
                  fontWeight: '400',
                  lineHeight: MSG_LINE_HEIGHT,
                  color: V.textPrimary,
                }}
              >
                {caption}
              </Text>
            </View>,
            onCaptionPress,
          )
        : null}
    </View>
  );
}

const multiImageGridStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    backgroundColor: V.bgElevated,
  },
  gridWrapEphemeral: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: V.accentGold,
  },
  gridWrapSelected: {
    borderWidth: 2,
    borderColor: V.accentSage,
  },
  cell: {
    overflow: 'hidden',
    backgroundColor: V.bgElevated,
  },
  cellPressed: {
    opacity: 0.92,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  moreOverlayText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 2,
  },
  metaOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 3,
  },
  timeText: {
    fontSize: TS_TEXT_SIZE,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
  },
  captionBox: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: GRID_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  captionBoxMine: {
    backgroundColor: V.bgElevated,
  },
  captionBoxTheir: {
    backgroundColor: V.inBubbleBg,
  },
});

export default MessageRow;
