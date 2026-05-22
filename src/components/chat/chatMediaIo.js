/**
 * Storage-safe room segment + reading local URIs as ArrayBuffer for uploads.
 */

import { File as ExpoFile } from 'expo-file-system';
import { sha256Hex } from '../../lib/sha256Hex';

/** Ключ объекта в Storage: только безопасные символы; `room_id` может быть с кириллицей и т.д. */
export async function storageRoomSegment(roomId) {
  return sha256Hex(roomId);
}

/** RN `fetch(content://|file://)` часто не читает файл; Expo `File.bytes()` обычно срабатывает. */
export async function readUriAsArrayBuffer(uri) {
  try {
    const f = new ExpoFile(uri);
    const bytes = await f.bytes();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (e) {
    console.warn('readUriAsArrayBuffer: File.bytes failed, trying fetch', e);
  }
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`fetch ${res.status}`);
  }
  return res.arrayBuffer();
}

/** Base64 без префикса data: — для телеметрии/Aria API. */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
