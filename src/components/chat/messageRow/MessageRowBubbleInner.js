import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { V } from '../../../theme';
import ChatReplyPreview from '../ChatReplyPreview';
import MessageRowTimeMeta from './MessageRowTimeMeta';
import MessageRowTextBubbleInner from './MessageRowTextBubbleInner';
import MessageRowVideoContent from './MessageRowVideoContent';
import MessageRowImageContent from './MessageRowImageContent';
import { MSG_TEXT_SIZE, MSG_LINE_HEIGHT } from '../messageBubbleLayoutConstants';

export default function MessageRowBubbleInner({
  rowKind,
  item,
  isMine,
  isEphemeral,
  isEdited,
  isSelected,
  ariaPanelUserAsIncoming,
  textSelectable,
  useAriaLinks,
  replyMsg,
  env,
  listExtra,
  isVideoRenderable,
  reactionsBar,
  bounceAnimVideo,
  hasReactions,
  bubbleMaxW,
  onMessagePress,
  handleMessagePress,
  onDoubleTapHeart,
  onLongPress,
}) {
  if (rowKind === 'text') {
    return (
      <MessageRowTextBubbleInner
        item={item}
        isMine={isMine}
        isEphemeral={isEphemeral}
        isEdited={isEdited}
        ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
        textSelectable={textSelectable}
        useAriaLinks={useAriaLinks}
        replyMsg={replyMsg}
        tickPausedRef={env.ephemeralTickPausedRef}
        env={env}
      />
    );
  }

  if (rowKind === 'video') {
    return (
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
    );
  }

  if (rowKind === 'ariaVoice') {
    return (
      <>
        <ChatReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(
          {
            ...item,
            message_type: 'voice',
            media_url: item.audio_uri,
          },
          isMine,
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
            tickPausedRef={env.ephemeralTickPausedRef}
          />
        </View>
      </>
    );
  }

  if (rowKind === 'image') {
    return (
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
        onDoubleTapHeart={onDoubleTapHeart}
        onLongPress={onLongPress}
      />
    );
  }

  return (
    <>
      <ChatReplyPreview replyMsg={replyMsg} />
      {env.renderMessageContent(item, isMine)}
      <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
        <MessageRowTimeMeta
          item={item}
          isMine={isMine}
          ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
          variant="legacy"
          tickPausedRef={env.ephemeralTickPausedRef}
        />
      </View>
    </>
  );
}
