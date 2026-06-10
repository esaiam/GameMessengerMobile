import { useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import { storageRoomSegment, readUriAsArrayBuffer } from './chatMediaIo';
import { DEFAULT_VOICE_WAVEFORM } from './voiceWaveformSamples';
import { formatDuration } from './chatMessageListFormat';
import { refreshChatsListAfterMessage } from '../../lib/chatsListSync';

export default function useChatMediaActions({
  roomId,
  nickname,
  peerName,
  replyTo,
  ephemeralSec,
  setReplyTarget,
  setUploading,
  setShowAttachMenu,
  appendOptimisticImage,
  appendOptimisticImages,
  handleImageUploadFinished,
  handleImageSendError,
  appendOptimisticVoice,
  handleVoiceUploadFinished,
  handleVoiceSendError,
}) {
  const uploadMedia = useCallback(async (uri, folder, ext, contentType) => {
    if (!roomId) {
      throw new Error('room_id отсутствует');
    }
    const roomSeg = await storageRoomSegment(roomId);
    const filePath = `${folder}/${roomSeg}/${Date.now()}.${ext}`;
    const bucket = 'chat-media';

    const useNativeStreamUpload =
      Platform.OS !== 'web' &&
      (folder === 'video' || (folder === 'images' && ext === 'gif'));

    if (useNativeStreamUpload) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Сессия недоступна, войди снова');
      }
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;
      const uploadResult = await uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'cache-control': 'max-age=3600',
          'x-upsert': 'false' } });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        let detail = `HTTP ${uploadResult.status}`;
        try {
          const parsed = JSON.parse(uploadResult.body || '{}');
          if (parsed?.message) detail = parsed.message;
          else if (parsed?.error) detail = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message || detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
    } else {
      const arrayBuffer = await readUriAsArrayBuffer(uri);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, arrayBuffer, { contentType, upsert: false });
      if (error) throw error;
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return publicUrl;
  }, [roomId]);

  const sendMediaMessage = useCallback(async (messageType, mediaUrl, extra = {}) => {
    const rawText = extra.text || '';
    const row = {
      room_id: roomId,
      player_name: nickname,
      text: rawText || '',
      message_type: messageType,
      media_url: mediaUrl || null,
      latitude: extra.latitude ?? null,
      longitude: extra.longitude ?? null,
      reply_to: replyTo?.id || null };
    if (ephemeralSec) {
      row.expires_at = new Date(Date.now() + ephemeralSec * 1000).toISOString();
    }
    if (Array.isArray(extra.media_urls) && extra.media_urls.length > 0) {
      row.media_urls = extra.media_urls;
    }
    if (messageType === 'voice' || messageType === 'audio') {
      const wf = extra.waveform;
      row.waveform = Array.isArray(wf) && wf.length > 0 ? [...wf] : DEFAULT_VOICE_WAVEFORM();
    } else if (extra.waveform !== undefined) {
      row.waveform = extra.waveform;
    }
    const { data, error } = await supabase.from('messages').insert(row).select('*').single();
    if (error) {
      if (__DEV__) console.warn('Chat media insert error:', error.message);
      throw error;
    }
    await refreshChatsListAfterMessage(nickname, roomId, peerName
      ? { contactName: peerName, last: data ?? null }
      : undefined);
    setReplyTarget(null);
    return data ?? null;
  }, [roomId, nickname, peerName, replyTo, ephemeralSec, setReplyTarget]);

  const pickImageFromGallery = useCallback(async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 10 });
    if (result.canceled || !result.assets?.[0]) return;
    const assets = result.assets;
    const localUri = assets[0].uri;
    if (assets.length === 1) {
      appendOptimisticImage?.(localUri);
    } else {
      appendOptimisticImages?.(assets.map((a) => a.uri));
    }
    setUploading(true);
    try {
      const uploadPromises = assets.map((asset) =>
        uploadMedia(asset.uri, 'images', 'jpg', 'image/jpeg'),
      );
      const urls = await Promise.all(uploadPromises);
      if (urls.length === 1) {
        await sendMediaMessage('image', urls[0]);
      } else {
        await sendMediaMessage('image', urls[0], { media_urls: urls });
      }
      handleImageUploadFinished?.();
    } catch (e) {
      handleImageSendError?.();
      const detail = e?.message || e?.error_description || String(e);
      Alert.alert('Ошибка', `Не удалось отправить фото.\n${detail}`);
      if (__DEV__) console.warn(e);
    } finally {
      setUploading(false);
    }
  }, [
    uploadMedia,
    sendMediaMessage,
    setUploading,
    setShowAttachMenu,
    appendOptimisticImage,
    appendOptimisticImages,
    handleImageUploadFinished,
    handleImageSendError,
  ]);

  const takePhoto = useCallback(async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true });
    if (result.canceled || !result.assets?.[0]) return;
    const localUri = result.assets[0].uri;
    appendOptimisticImage?.(localUri);
    setUploading(true);
    try {
      const url = await uploadMedia(localUri, 'images', 'jpg', 'image/jpeg');
      await sendMediaMessage('image', url);
      handleImageUploadFinished?.();
    } catch (e) {
      handleImageSendError?.();
      const detail = e?.message || e?.error_description || String(e);
      Alert.alert('Ошибка', `Не удалось отправить фото.\n${detail}`);
      if (__DEV__) console.warn(e);
    }
    setUploading(false);
  }, [
    uploadMedia,
    sendMediaMessage,
    setUploading,
    setShowAttachMenu,
    appendOptimisticImage,
    handleImageUploadFinished,
    handleImageSendError,
  ]);

  const sendCurrentLocation = useCallback(async () => {
    setShowAttachMenu(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к геолокации в настройках');
      return;
    }
    setUploading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced });
      await sendMediaMessage('location', null, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        text: 'Местоположение' });
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось определить местоположение');
      if (__DEV__) console.warn(e);
    }
    setUploading(false);
  }, [sendMediaMessage, setUploading, setShowAttachMenu]);

  const handleSendVoice = useCallback(
    async (uri, duration, waveform) => {
      appendOptimisticVoice?.({ localUri: uri, duration, waveform });
      setUploading(true);
      try {
        const url = await uploadMedia(uri, 'voice', 'm4a', 'audio/m4a');
        const wf =
          Array.isArray(waveform) && waveform.length > 0 ? waveform : DEFAULT_VOICE_WAVEFORM();
        await sendMediaMessage('voice', url, {
          text: `🎤 ${formatDuration(duration)}`,
          waveform: wf });
        handleVoiceUploadFinished?.();
      } catch (e) {
        handleVoiceSendError?.();
        const detail = e?.message || e?.error_description || String(e);
        Alert.alert('Ошибка', `Не удалось отправить голосовое.\n${detail}`);
        if (__DEV__) console.warn(e);
      }
      setUploading(false);
    },
    [
      uploadMedia,
      sendMediaMessage,
      setUploading,
      appendOptimisticVoice,
      handleVoiceUploadFinished,
      handleVoiceSendError,
    ],
  );

  return {
    uploadMedia,
    sendMediaMessage,
    pickImageFromGallery,
    takePhoto,
    sendCurrentLocation,
    handleSendVoice };
}
