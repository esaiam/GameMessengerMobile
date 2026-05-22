import { decryptVm2MessageText, isVm2Payload } from '../../lib/vm2MessageText';

/** Кэш превью: ключ — msgId (текст сообщения неизменен после создания). */
const _previewCache = new Map();
const MAX_PREVIEW_CACHE_ENTRIES = 200;

export function clearPreviewCache() {
  _previewCache.clear();
}

function trimPreviewCacheIfNeeded() {
  while (_previewCache.size > MAX_PREVIEW_CACHE_ENTRIES) {
    const k = _previewCache.keys().next().value;
    _previewCache.delete(k);
  }
}

function mediaTypePreview(msg) {
  if (!msg?.message_type || msg.message_type === 'text') return null;
  if (msg.message_type === 'image') return 'Фото';
  if (msg.message_type === 'audio' || msg.message_type === 'voice') return 'Голосовое';
  if (msg.message_type === 'location') return 'Геолокация';
  return 'Сообщение';
}

/** Синхронное превью (медиа-типы и plaintext). VM2 — placeholder до async. */
export function messagePreview(msg) {
  if (!msg) return 'Нет сообщений';
  const media = mediaTypePreview(msg);
  if (media) return media;
  const text = msg.text || '';
  if (isVm2Payload(text)) return '[зашифровано]';
  return text || 'Сообщение';
}

/** Async-превью с расшифровкой VM2 для списка чатов. */
export async function messagePreviewAsync(msg, nickname) {
  if (!msg) return 'Нет сообщений';
  const media = mediaTypePreview(msg);
  if (media) return media;

  const cacheKey = msg.id;
  if (cacheKey && _previewCache.has(cacheKey)) {
    return _previewCache.get(cacheKey);
  }

  const text = msg.text || '';
  let result = 'Сообщение';
  if (isVm2Payload(text)) {
    const plain = await decryptVm2MessageText(text, msg, nickname);
    result = plain && plain.trim() ? plain : '[зашифровано]';
  } else if (text) {
    result = text;
  }

  if (cacheKey) {
    if (_previewCache.has(cacheKey)) _previewCache.delete(cacheKey);
    _previewCache.set(cacheKey, result);
    trimPreviewCacheIfNeeded();
  }
  return result;
}
