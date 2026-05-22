import { useCallback } from 'react';
import { Alert } from 'react-native';
import { downloadRemoteImageToCache } from '../../lib/downloadRemoteImageToCache';
import { stripPicInlineTrigger } from '../../lib/parsePicInlineQuery';
import { stripGifInlineTrigger } from '../../lib/parseGifInlineQuery';

/**
 * Отправка фото/GIF из inline-панели и emoji GIF tab.
 * Зависит от upload/send из useChatMediaActions.
 */
export default function useChatInlineMediaSend({
  text,
  setText,
  setUploading,
  uploadMedia,
  sendMediaMessage,
}) {
  const sendGifFromRemote = useCallback(
    async (item, { caption = '' } = {}) => {
      if (!item?.fullUrl && !item?.thumbUrl) return;
      const remoteUrl = item.fullUrl || item.thumbUrl;
      setUploading(true);
      try {
        const localUri = await downloadRemoteImageToCache(remoteUrl, 'gif');
        const url = await uploadMedia(localUri, 'images', 'gif', 'image/gif');
        const trimmed = String(caption || '').trim();
        await sendMediaMessage('image', url, trimmed ? { text: trimmed } : {});
      } catch (e) {
        const detail = e?.message || String(e);
        Alert.alert('Ошибка', `Не удалось отправить GIF.\n${detail}`);
        if (__DEV__) console.warn(e);
      }
      setUploading(false);
    },
    [uploadMedia, sendMediaMessage, setUploading],
  );

  const handlePicInlineSelect = useCallback(
    async (item) => {
      if (!item?.fullUrl && !item?.thumbUrl) return;
      const remoteUrl = item.fullUrl || item.thumbUrl;
      setUploading(true);
      try {
        const localUri = await downloadRemoteImageToCache(remoteUrl, 'jpg');
        const url = await uploadMedia(localUri, 'images', 'jpg', 'image/jpeg');
        const caption = stripPicInlineTrigger(text);
        await sendMediaMessage('image', url, caption ? { text: caption } : {});
        setText(caption);
      } catch (e) {
        const detail = e?.message || String(e);
        Alert.alert('Ошибка', `Не удалось отправить фото.\n${detail}`);
        if (__DEV__) console.warn(e);
      }
      setUploading(false);
    },
    [text, uploadMedia, sendMediaMessage, setText, setUploading],
  );

  const handleGifInlineSelect = useCallback(
    async (item) => {
      const caption = stripGifInlineTrigger(text);
      await sendGifFromRemote(item, { caption });
      setText(caption);
    },
    [text, sendGifFromRemote, setText],
  );

  const handleEmojiPanelGifSelect = useCallback(
    async (item) => {
      if (item?.reuseUrl && item.fullUrl) {
        setUploading(true);
        try {
          const trimmed = String(text || '').trim();
          await sendMediaMessage('image', item.fullUrl, trimmed ? { text: trimmed } : {});
        } catch (e) {
          const detail = e?.message || String(e);
          Alert.alert('Ошибка', `Не удалось отправить GIF.\n${detail}`);
          if (__DEV__) console.warn(e);
        }
        setUploading(false);
        return;
      }
      await sendGifFromRemote(item, { caption: text });
    },
    [text, sendGifFromRemote, sendMediaMessage, setUploading],
  );

  return {
    handlePicInlineSelect,
    handleGifInlineSelect,
    handleEmojiPanelGifSelect,
  };
}
