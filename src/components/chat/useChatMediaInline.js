import { useEffect, useMemo } from 'react';
import usePicInlineSearch from '../../hooks/usePicInlineSearch';
import useGifInlineSearch from '../../hooks/useGifInlineSearch';
import usePanelGifSearch from '../../hooks/usePanelGifSearch';
import { parseActiveInlineMediaQuery } from '../../lib/parseInlineTrigger';
import useChatInlineMediaSend from './useChatInlineMediaSend';

/**
 * Inline /pic /gif composer search and emoji-panel GIF search; closes emoji picker when inline opens.
 * Depends on: text, uploadMedia/sendMediaMessage from useChatComposerSend, showEmojiPicker state.
 */
export default function useChatMediaInline({
  text,
  setText,
  setUploading,
  emojiPanelGifQuery,
  showEmojiPicker,
  setShowEmojiPicker,
  isAriaChat,
  roomId,
  uploadMedia,
  sendMediaMessage,
}) {
  const inlineMediaEnabled = !isAriaChat && Boolean(roomId);

  const activeInlineMedia = useMemo(
    () => (inlineMediaEnabled ? parseActiveInlineMediaQuery(text) : null),
    [text, inlineMediaEnabled],
  );

  const picInline = usePicInlineSearch(text, {
    enabled: inlineMediaEnabled && activeInlineMedia?.kind === 'pic',
  });

  const gifInline = useGifInlineSearch(text, {
    enabled: inlineMediaEnabled && activeInlineMedia?.kind === 'gif',
  });

  const emojiPanelGif = usePanelGifSearch(emojiPanelGifQuery, {
    enabled: inlineMediaEnabled && showEmojiPicker,
  });

  useEffect(() => {
    if ((picInline.active || gifInline.active) && showEmojiPicker) {
      setShowEmojiPicker(false);
    }
  }, [picInline.active, gifInline.active, showEmojiPicker, setShowEmojiPicker]);

  const {
    handlePicInlineSelect,
    handleGifInlineSelect,
    handleEmojiPanelGifSelect,
  } = useChatInlineMediaSend({
    text,
    setText,
    setUploading,
    uploadMedia,
    sendMediaMessage,
  });

  return {
    picInlineVisible: picInline.active,
    picInlineNeedsQuery: picInline.needsQuery,
    picInlineLoading: picInline.loading,
    picInlineError: picInline.error,
    picInlineResults: picInline.results,
    picInlineHasMore: picInline.hasMore,
    onPicInlineSelect: handlePicInlineSelect,
    onPicInlineLoadMore: picInline.loadMore,
    gifInlineVisible: gifInline.active,
    gifInlineNeedsQuery: gifInline.needsQuery,
    gifInlineLoading: gifInline.loading,
    gifInlineError: gifInline.error,
    gifInlineResults: gifInline.results,
    gifInlineHasMore: gifInline.hasMore,
    onGifInlineSelect: handleGifInlineSelect,
    onGifInlineLoadMore: gifInline.loadMore,
    emojiPanelGifLoading: emojiPanelGif.loading,
    trendingGifs: emojiPanelGif.trendingResults,
    emojiPanelGifError: emojiPanelGif.error,
    emojiPanelGifResults: emojiPanelGif.results,
    emojiPanelGifHasMore: emojiPanelGif.hasMore,
    onEmojiPanelGifSelect: handleEmojiPanelGifSelect,
    onEmojiPanelGifLoadMore: emojiPanelGif.loadMore,
  };
}
