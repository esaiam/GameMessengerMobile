import React from 'react';
import { View } from 'react-native';
import { useDoubleTapPress } from './useDoubleTapPress';
import ChatReplyPreview from '../ChatReplyPreview';
import ChatImageMessage from '../ChatImageMessage';
import ChatMultiImageGrid from './ChatMultiImageGrid';
import { isGifMediaUrl } from '../../../lib/isGifMediaUrl';

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

  return (
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
            onDoubleTapHeart={onDoubleTapHeart}
            onCaptionPress={onCaptionPress}
            onLongPress={onLongPress}
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
                ? Math.floor(windowWidth * 0.86)
                : bubbleMaxW
            }
            isEphemeral={isEphemeral}
            expiresAt={item.expires_at}
            isSelected={isSelected}
            isUploading={item._isOptimistic === true}
            onPress={handleImagePress}
            onCaptionPress={onCaptionPress}
            onLongPress={onLongPress}
          />
        )}
        {!isMine ? <View style={imageRowStyles.chromeHit} /> : null}
      </View>
    </>
  );
}
