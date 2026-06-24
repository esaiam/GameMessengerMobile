import React from 'react';
import { View, Animated, Text } from 'react-native';
import { V } from '../../../theme';
import { isAriaTypewriterPending } from '../../../lib/aria';
import { AriaTypingIndicator } from '../AriaChatUi';
import AriaGeneratedAttachment from '../AriaGeneratedAttachment';
import AriaTypewriterText from '../AriaTypewriterText';
import AriaMessageFeedbackBar from '../AriaMessageFeedbackBar';
import { MSG_TEXT_SIZE, MSG_LINE_HEIGHT } from '../messageBubbleLayoutConstants';

function AriaPlainTextRow({
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
  const plainBodyStyle = {
    fontSize: MSG_TEXT_SIZE,
    fontWeight: '400',
    lineHeight: MSG_LINE_HEIGHT,
    color: V.textPrimary,
  };
  const typewriterPending = isAriaTypewriterPending(item);

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
          <AriaTypewriterText
            key={item.id}
            text={item.text}
            done={!typewriterPending}
            messageId={item.id}
            onRevealComplete={env.onAriaRevealComplete}
            style={plainBodyStyle}
            useLinks={useAriaLinks}
            selectable={textSelectable}
          />
          {ariaGeneratedAttachment && !typewriterPending ? (
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
          {!typewriterPending && item.aria_reveal_done !== false ? (
            <AriaMessageFeedbackBar item={item} onFeedback={env.onAriaFeedback} />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

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
    const preview =
      typeof item?.aria_stream_preview === 'string' ? item.aria_stream_preview : '';
    return (
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {dateSeparatorEl}
        <View style={{ paddingVertical: 6, alignItems: 'flex-start', backgroundColor: 'transparent' }}>
          <AriaTypingIndicator phase={item?.aria_stream_phase} hideLabel={preview.length > 0} />
          {preview.length > 0 ? (
            <Text
              style={{
                marginTop: 10,
                fontSize: MSG_TEXT_SIZE,
                lineHeight: MSG_LINE_HEIGHT,
                fontWeight: '400',
                color: V.textPrimary,
                maxWidth: '100%',
              }}
            >
              {preview}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (kind === 'ariaPlainText') {
    return (
      <AriaPlainTextRow
        key={item.id}
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

  return null;
}
