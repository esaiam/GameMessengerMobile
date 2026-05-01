/**
 * Текст для «Копировать» из контекстного меню (без расшифровки).
 * @param {import('./chatMessageTypes').ChatMessageRow} item
 */
export function getMessageCopyText(item) {
  const type = item.message_type || 'text';
  if (type === 'image') return item.text?.trim() || '[Фото]';
  if (type === 'voice' || type === 'audio') return item.text?.trim() || '[Голосовое сообщение]';
  if (type === 'location' && item.latitude != null && item.longitude != null) {
    return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
  }
  return item.text || '';
}

/**
 * Одна строка для мультикопирования: строка уже расшифрована (как в ленте после decryptMsg).
 * Геолокация с координатами — та же ссылка, что в контекстном меню.
 * @param {import('./chatMessageTypes').ChatMessageRow} m
 */
export function getBatchCopyLineFromDecrypted(m) {
  const type = m.message_type || 'text';
  if (type === 'text') return (m.text || '').trim() || ' ';
  if (type === 'image') return '[Фото]';
  if (type === 'voice' || type === 'audio') return '[Голосовое]';
  if (type === 'video') return '[Видео]';
  if (type === 'location' && m.latitude != null && m.longitude != null) {
    return `https://www.google.com/maps?q=${m.latitude},${m.longitude}`;
  }
  if (type === 'location') return '[Геолокация]';
  return '[Сообщение]';
}
