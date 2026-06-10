import React from 'react';
import { View, Text, Animated } from 'react-native';
import { V } from '../../../theme';
import { AriaTypingDots } from '../AriaChatUi';
import AriaGeneratedAttachment from '../AriaGeneratedAttachment';
import { LinkifyMessageText } from '../linkifyMessageText';
import { MSG_TEXT_SIZE, MSG_LINE_HEIGHT } from '../messageBubbleLayoutConstants';

export default function MessageRowAriaPlain({
  kind,
  item,
  index,
  rowMarginBottom,
  dateSeparatorEl,
  messageRowAnims,
  useAriaLinks,
  textSelectable,
  ariaGeneratedAttachment,
  ariaImageMaxW,
  bubbleMaxW,
  env,
}) {
  if (kind === 'ariaPlainTyping') {
    return (
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {dateSeparatorEl}
        <View style={{ paddingVertical: 8, alignItems: 'flex-start' }}>
          <AriaTypingDots />
        </View>
      </View>
    );
  }

  if (kind === 'ariaPlainText') {
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

  return null;
}
