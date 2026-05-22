/** URL вложения — анимированный GIF (не статичное фото). */
export function isGifMediaUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const path = url.split('?')[0].toLowerCase();
  return path.endsWith('.gif') || path.includes('.gif/');
}
