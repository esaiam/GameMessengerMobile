import * as FileSystem from 'expo-file-system/legacy';

/**
 * Скачивает удалённое изображение/GIF во временный файл для uploadMedia.
 * @param {string} remoteUrl
 * @param {'jpg'|'png'|'gif'} [ext]
 * @returns {Promise<string>} local file:// URI
 */
export async function downloadRemoteImageToCache(remoteUrl, ext) {
  const resolved =
    ext ||
    (remoteUrl.includes('.gif') ? 'gif' : remoteUrl.includes('.png') ? 'png' : 'jpg');
  const dest = `${FileSystem.cacheDirectory}inline-media-${Date.now()}.${resolved}`;
  const result = await FileSystem.downloadAsync(remoteUrl, dest);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Не удалось скачать изображение (${result.status})`);
  }
  return result.uri;
}
