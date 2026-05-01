/**
 * Storage-safe room segment + reading local URIs as ArrayBuffer for uploads.
 */

import CryptoJS from 'crypto-js';
import { File as ExpoFile } from 'expo-file-system';

/** Ключ объекта в Storage: только безопасные символы; `room_id` может быть с кириллицей и т.д. */
export function storageRoomSegment(roomId) {
  return CryptoJS.SHA256(String(roomId)).toString(CryptoJS.enc.Hex);
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
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function readUriAsBase64(uri) {
  const buf = await readUriAsArrayBuffer(uri);
  return arrayBufferToBase64(buf);
}
