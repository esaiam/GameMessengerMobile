import { deriveKey, decrypt, looksLikeEncryptedPayload } from '../../utils/crypto';

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

function decryptPreview(text, roomCode) {
  if (!text) return '';
  if (text.startsWith('VM2:')) return '[зашифровано]';
  if (!roomCode) return text;
  const key = deriveKey(roomCode);
  const plain = decrypt(text, key);
  if (plain != null && plain !== '') return plain;
  if (looksLikeEncryptedPayload(text)) return 'Не удалось расшифровать';
  return text;
}

export function messagePreview(msg, roomCode) {
  if (!msg) return 'Нет сообщений';
  if (msg.message_type && msg.message_type !== 'text') {
    if (msg.message_type === 'image') return 'Фото';
    if (msg.message_type === 'audio') return 'Голосовое';
    if (msg.message_type === 'location') return 'Геолокация';
    return 'Сообщение';
  }
  const cacheKey = msg.id;
  if (_previewCache.has(cacheKey)) return _previewCache.get(cacheKey);
  const result = decryptPreview(msg.text || '', roomCode) || 'Сообщение';
  if (_previewCache.has(cacheKey)) _previewCache.delete(cacheKey);
  _previewCache.set(cacheKey, result);
  trimPreviewCacheIfNeeded();
  return result;
}
