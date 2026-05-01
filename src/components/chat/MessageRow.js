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
import MessageBubbleSwipeWrap from './MessageBubbleSwipeWrap';
import { ARIA_MESSAGE_TYPING } from '../../lib/aria';
import { AriaGradientAvatar, AriaTypingDots } from './AriaChatUi';
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
} from './messageBubbleLayoutConstants';

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
    const emitMessageLongPress = (e) => {
      const x = e?.nativeEvent?.pageX ?? 0;
      const y = e?.nativeEvent?.pageY ?? 0;
      onMessageLongPress({ nativeEvent: { pageX: x, pageY: y } }, item);
    };
    const fireReply = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      rowEnvRef.current.replyToMessage?.(item);
    }, [item]);
    const isMine = item.player_name === env.nickname;
    const replyMsg = env.getReplyMessage(item.reply_to);
    const isVideoMessage = item.message_type === 'video';
    const isAriaTyping =
      item.message_type === ARIA_MESSAGE_TYPING || item.isTyping === true;
    const showAriaAvatarInBubbleRow =
      !!env.isAriaChat &&
      !isMine &&
      !isVideoMessage &&
      !isAriaTyping &&
      item.player_name === env.ariaPeerName;
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
          useNativeDriver: true,
        }).start();
        bounceAnimVideo.setValue(1.04);
        Animated.spring(bounceAnimVideo, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: false,
        }).start();
      }
    }, [isSelected, bounceAnim, bounceAnimVideo]);

    let rowMarginBottom = 0;
    if (item._abovePlayerName != null) {
      rowMarginBottom = 4;
    }

    const bubbleMaxW = env.windowWidth * 0.75;

    const bubbleRadii = isMine
      ? {
          borderTopLeftRadius: BUBBLE_RADIUS,
          borderTopRightRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: BUBBLE_RADIUS,
          borderBottomRightRadius: BUBBLE_TAIL,
        }
      : {
          borderTopLeftRadius: BUBBLE_RADIUS,
          borderTopRightRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: BUBBLE_TAIL,
          borderBottomRightRadius: BUBBLE_RADIUS,
        };

    /** Голос Aria с локальным файлом — плеер + опционально транскрипт (иначе старый Mic+текст). */
    const isAriaVoiceBubble =
      item.aria_voice_message === true && !!item.audio_uri;
    const isTextMessage =
      !isAriaTyping &&
      !isAriaVoiceBubble &&
      (item.aria_voice_message === true ||
        !item.message_type ||
        item.message_type === 'text');
    const timeColor = isMine
      ? 'rgba(186, 222, 218, 0.52)'
      : 'rgba(168, 162, 152, 0.58)';
    const bodyColor = V.textPrimary;

    const timeMeta = (
      <>
        {isEphemeral && <ChatEphemeralCountdown expiresAt={item.expires_at} />}
        <Text style={{ fontSize: TS_TEXT_SIZE, color: timeColor, fontWeight: '400' }}>
          {item._formattedTime}
        </Text>
        <ChatReadCheck isRead={!!item.read_at} isMine={isMine} />
      </>
    );

    const metaReservePx =
      (isMine ? META_RESERVE_PX_OUTGOING : META_RESERVE_PX_INCOMING) +
      (isEphemeral ? META_RESERVE_PX_EPHEMERAL_EXTRA : 0);

    const videoEdgeStripStyle = { flex: 1, alignSelf: 'stretch' };
    /* Клип круга — только внутри VideoMessage (Animated.View + overflow: hidden). Здесь без overflow: hidden — иначе предок expo-video ломает композицию вместе с нативным драйвером на строке. */
    const videoCircleChrome = {
      borderRadius: 120,
      ...(isEphemeral ? { borderWidth: 0.5, borderColor: V.accentGold } : {}),
    };

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
                maxWidth: '100%',
              }}
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
                  color: bodyColor,
                }}
              >
                {item.text}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                fontSize: MSG_TEXT_SIZE,
                fontWeight: '400',
                lineHeight: MSG_LINE_HEIGHT,
                color: bodyColor,
              }}
            >
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
              gap: 2,
            }}
          >
            {timeMeta}
          </View>
        </View>
      </>
    ) : isVideoMessage ? (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            width: '100%',
            alignSelf: 'stretch',
          }}
        >
          {isMine ? (
            <>
              <Pressable
                style={videoEdgeStripStyle}
                onPress={(e) => onMessagePress(e, item)}
                onLongPress={emitMessageLongPress}
                delayLongPress={400}
              />
              <Animated.View style={{ transform: [{ scale: bounceAnimVideo }] }}>
                <View style={{ ...videoCircleChrome, alignSelf: 'flex-start' }}>
                  {isVideoRenderable
                    ? env.renderMessageContent(item, isMine)
                    : (
                      <ChatVideoPlaceholder
                        onPress={() => listExtra.onUnlockVideo?.(item.id)}
                      />
                    )}
                </View>
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View style={{ transform: [{ scale: bounceAnimVideo }] }}>
                <View style={{ ...videoCircleChrome, alignSelf: 'flex-start' }}>
                  {isVideoRenderable
                    ? env.renderMessageContent(item, isMine)
                    : (
                      <ChatVideoPlaceholder
                        onPress={() => listExtra.onUnlockVideo?.(item.id)}
                      />
                    )}
                </View>
              </Animated.View>
              <Pressable
                style={videoEdgeStripStyle}
                onPress={(e) => onMessagePress(e, item)}
                onLongPress={emitMessageLongPress}
                delayLongPress={400}
              />
            </>
          )}
        </View>
      </>
    ) : isAriaVoiceBubble ? (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(
          {
            ...item,
            message_type: 'voice',
            media_url: item.audio_uri,
          },
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
              color: V.textSecondary,
            }}
          >
            {item.transcription}
          </Text>
        ) : null}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          {timeMeta}
        </View>
      </>
    ) : (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(item, isMine)}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          {timeMeta}
        </View>
      </>
    );

    return (
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {item._showDate && (
          <ChatDateSeparator label={item._dateLabel} withTopGap={index < listLength - 1} />
        )}
        {isAriaTyping ? (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }],
            }}
          >
            <View
              style={[
                tw`flex-row items-end px-4`,
                isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
              ]}
            >
              <View style={{ marginRight: 8, marginBottom: 2 }}>
                <AriaGradientAvatar size={34} />
              </View>
              <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    marginBottom: 3,
                    color: V.accentSage,
                  }}
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
        ) : isVideoMessage ? (
          <View>
            <View
              style={[
                tw`${isMine ? 'items-end' : 'items-start'} px-4`,
                isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
              ]}
            >
              {!isMine && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    marginBottom: 3,
                    marginLeft: 4,
                    color: V.accentSage,
                  }}
                  numberOfLines={1}
                >
                  {item.player_name}
                </Text>
              )}
              {isMine ? (
                <View style={{ width: '100%', alignSelf: 'stretch' }}>
                  <MessageBubbleSwipeWrap
                    enabled={!listExtra.selectionMode}
                    isMine
                    onReply={fireReply}
                  >
                    <View style={{ alignSelf: 'flex-end', width: '100%' }}>{bubbleInner}</View>
                  </MessageBubbleSwipeWrap>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      paddingHorizontal: 4,
                      marginTop: 2,
                    }}
                  >
                    {timeMeta}
                  </View>
                </View>
              ) : (
                <View style={{ width: '100%', alignSelf: 'stretch' }}>
                  <MessageBubbleSwipeWrap
                    enabled={!listExtra.selectionMode}
                    isMine={false}
                    onReply={fireReply}
                  >
                    <View style={{ alignSelf: 'flex-start', width: '100%' }}>{bubbleInner}</View>
                  </MessageBubbleSwipeWrap>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-start',
                      paddingHorizontal: 4,
                      marginTop: 2,
                    }}
                  >
                    {timeMeta}
                  </View>
                </View>
              )}
              {!listExtra.isAriaChat ? (
                <ChatReactionsBar
                  reactions={item.reactions}
                  onReact={(emoji) =>
                    listExtra.selectionMode
                      ? onMessagePress(undefined, item)
                      : env.toggleReaction(item.id, emoji)
                  }
                />
              ) : null}
            </View>
          </View>
        ) : (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }],
            }}
          >
            <Pressable
              onPress={(e) => onMessagePress(e, item)}
              onLongPress={emitMessageLongPress}
              delayLongPress={400}
              style={{ width: '100%' }}
            >
              <View
                style={[
                  tw`${isMine ? 'items-end' : 'items-start'} px-4`,
                  !isMine && showAriaAvatarInBubbleRow && { flexDirection: 'row', alignItems: 'flex-end' },
                  isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
                ]}
              >
                {showAriaAvatarInBubbleRow ? (
                  <View style={{ marginRight: 8, marginBottom: 2 }}>
                    <AriaGradientAvatar size={34} />
                  </View>
                ) : null}
                <View
                  style={{
                    flex: showAriaAvatarInBubbleRow ? 1 : undefined,
                    minWidth: showAriaAvatarInBubbleRow ? 0 : undefined,
                    alignSelf: isMine ? 'stretch' : 'flex-start',
                    width: isMine ? '100%' : undefined,
                  }}
                >
                  {!isMine && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        marginBottom: 3,
                        marginLeft: showAriaAvatarInBubbleRow ? 0 : 4,
                        color: V.accentSage,
                      }}
                      numberOfLines={1}
                    >
                      {item.player_name}
                    </Text>
                  )}
                  <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
                    <MessageBubbleSwipeWrap
                      enabled={!listExtra.selectionMode}
                      isMine={isMine}
                      onReply={fireReply}
                    >
                      {isMine ? (
                        <OutgoingBubble
                          message={item}
                          bubbleMaxW={bubbleMaxW}
                          bubbleRadii={bubbleRadii}
                          isEphemeral={isEphemeral}
                          isSelected={false}
                          selectionMode={listExtra.selectionMode}
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
                        >
                          {bubbleInner}
                        </BubbleMaterial>
                      )}
                    </MessageBubbleSwipeWrap>
                  </Animated.View>
                  {!listExtra.isAriaChat ? (
                    <ChatReactionsBar
                      reactions={item.reactions}
                      onReact={(emoji) =>
                        listExtra.selectionMode
                          ? onMessagePress(undefined, item)
                          : env.toggleReaction(item.id, emoji)
                      }
                    />
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

export default MessageRow;
