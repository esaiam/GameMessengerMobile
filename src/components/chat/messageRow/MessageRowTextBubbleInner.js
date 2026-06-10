import React from 'react';
import { View, Text } from 'react-native';
import { V } from '../../../theme';
import { Mic } from '../../../icons/lucideIcons';
import ChatReplyPreview from '../ChatReplyPreview';
import { LinkifyMessageText } from '../linkifyMessageText';
import MessageRowTimeMeta, { computeMessageRowMetaReservePx } from './MessageRowTimeMeta';
import { MSG_TEXT_SIZE, MSG_LINE_HEIGHT } from '../messageBubbleLayoutConstants';

export default function MessageRowTextBubbleInner({
  item,
  isMine,
  isEphemeral,
  isEdited,
  ariaPanelUserAsIncoming,
  textSelectable,
  useAriaLinks,
  replyMsg,
}) {
  const textBodyColor =
    isMine && !ariaPanelUserAsIncoming ? V.outBubbleText : V.inBubbleText;
  const ariaTextBodyStyle = {
    fontSize: MSG_TEXT_SIZE,
    fontWeight: '400',
    lineHeight: MSG_LINE_HEIGHT,
    color: textBodyColor,
  };
  const metaReservePx = computeMessageRowMetaReservePx({
    isMine,
    isEphemeral,
    isEdited,
  });

  return (
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
                color: textBodyColor,
              }}
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
            gap: 2,
          }}
        >
          <MessageRowTimeMeta
            item={item}
            isMine={isMine}
            ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
            variant="text"
          />
        </View>
      </View>
    </>
  );
}
