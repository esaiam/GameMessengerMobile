import React from 'react';
import { View } from 'react-native';
import { useDoubleTapPress } from './useDoubleTapPress';
import ChatReplyPreview from '../ChatReplyPreview';
import ChatImageMessage from '../ChatImageMessage';
import ChatMediaPlaceholder from '../ChatMediaPlaceholder';
import ChatMultiImageGrid from './ChatMultiImageGrid';
import { isGifMediaUrl } from '../../../lib/isGifMediaUrl';
import { resolveChatMediaLayoutMaxWidth } from '../messageBubbleLayoutConstants';

/** Зона «рядом с фото» — тап открывает меню; flex забирает пустое место в строке */
const imageRowStyles = {
  row: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-end',
    minHeight: 44,
  },
  chromeHit: {
    flex: 1,
    alignSelf: 'stretch',
  },
};

export default function MessageRowImageContent({
  item,
  isMine,
  bubbleMaxW,
  windowWidth,
  isEphemeral,
  isSelected,
  listExtra,
  env,
  replyMsg,
  onMessagePress,
  onCaptionPress,
  onDoubleTapHeart,
  onLongPress,
}) {
  const handleImagePress = useDoubleTapPress(
    (e) => {
      if (listExtra.selectionMode) onMessagePress(e, item);
      else env.setFullScreenImage?.({ uris: [item.media_url], index: 0 });
    },
    onDoubleTapHeart,
  );

  const isGif = isGifMediaUrl(item.media_url);
  const layoutMaxWidth = resolveChatMediaLayoutMaxWidth(windowWidth, bubbleMaxW, {
    isTablet: env.isTablet,
    isGif,
  });
  const imageMessageProps = {
    caption: item.text,
    formattedTime: item._formattedTime,
    isRead: !!item.read_at,
    isMine,
    isGif,
    layoutMaxWidth,
    isEphemeral,
    expiresAt: item.expires_at,
    isSelected,
    isUploading: item._isOptimistic === true,
    onPress: handleImagePress,
    onCaptionPress,
    onLongPress,
  };

  return (
    <>
      <ChatReplyPreview replyMsg={replyMsg} />
      <View style={imageRowStyles.row}>
        {isMine ? <View style={imageRowStyles.chromeHit} /> : null}
        {Array.isArray(item.media_urls) && item.media_urls.length > 1 ? (
          <ChatMultiImageGrid
            urls={item.media_urls}
            caption={item.text}
            layoutMaxWidth={layoutMaxWidth}
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
            onDoubleTapHeart={onDoubleTapHeart}
            onCaptionPress={onCaptionPress}
            onLongPress={onLongPress}
            suppressHeavyMedia={listExtra.suppressHeavyMedia}
            tickPausedRef={env.ephemeralTickPausedRef}
          />
        ) : listExtra.suppressHeavyMedia ? (
          <ChatMediaPlaceholder
            {...imageMessageProps}
            tickPausedRef={env.ephemeralTickPausedRef}
          />
        ) : (
          <ChatImageMessage
            uri={item.media_url}
            {...imageMessageProps}
          />
        )}
        {!isMine ? <View style={imageRowStyles.chromeHit} /> : null}
      </View>
    </>
  );
}
