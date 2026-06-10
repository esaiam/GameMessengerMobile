import React from 'react';
import { View, Text, Animated, Pressable } from 'react-native';
import tw from 'twrnc';
import { V } from '../../../theme';
import OutgoingBubble from '../OutgoingBubble';
import BubbleMaterial from '../BubbleMaterial';
import MessageBubbleSwipeWrap from '../MessageBubbleSwipeWrap';
import { AriaTypingDots } from '../AriaChatUi';
import AriaGeneratedAttachment from '../AriaGeneratedAttachment';
import { MESSAGE_ROW_SELECTION_BG } from '../messageBubbleLayoutConstants';

export default function MessageRowBubbleChrome({
  rowKind,
  item,
  index,
  rowMarginBottom,
  dateSeparatorEl,
  messageRowAnims,
  rowEdgePadTw,
  isSelected,
  isMine,
  bubbleMaxW,
  bubbleRadii,
  bubbleAnchorStyle,
  bubbleSwipeEnabled,
  bubbleInner,
  reactionsBar,
  fireReply,
  handleMessagePress,
  emitMessageLongPress,
  textSelectable,
  bounceAnim,
  listExtra,
  isEphemeral,
  hasAriaImageAttachment,
  ariaGeneratedAttachment,
  ariaImageMaxW,
  env,
}) {
  const TextMessageWrapper = textSelectable ? View : Pressable;
  const textMessageWrapperProps = textSelectable
    ? { style: { width: '100%' } }
    : {
        onPress: handleMessagePress,
        onLongPress: emitMessageLongPress,
        delayLongPress: 400,
        style: { width: '100%' },
      };

  return (
    <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
      {dateSeparatorEl}
      {rowKind === 'typing' ? (
        <Animated.View
          style={{
            opacity: messageRowAnims.opacity,
            transform: [{ scale: messageRowAnims.scale }],
          }}
        >
          <View
            style={[
              tw`flex-row items-end ${rowEdgePadTw}`,
              isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
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
            <View style={bubbleAnchorStyle}>
              <MessageBubbleSwipeWrap
                enabled={bubbleSwipeEnabled}
                isMine={isMine}
                onReply={fireReply}
              >
                <View
                  style={{
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                    maxWidth: '100%',
                  }}
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
            transform: [{ scale: messageRowAnims.scale }],
          }}
        >
          <TextMessageWrapper {...textMessageWrapperProps}>
            <View
              style={[
                tw`${isMine ? 'items-end' : 'items-start'} ${rowEdgePadTw}`,
                isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
              ]}
            >
              <View
                style={{
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
                      marginLeft: 4,
                      color: V.accentSage,
                    }}
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
                      layoutMaxWidth={
                        ariaGeneratedAttachment?.mime_type === 'image/png'
                          ? ariaImageMaxW
                          : bubbleMaxW
                      }
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
}
