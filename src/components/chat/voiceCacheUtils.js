/**
 * Voice message HTTPS → local cache: extension sniff, URI normalization, downloaded file size.
 */

import { File as ExpoFile } from 'expo-file-system';

/** Расширение локального кэша на Android — должно совпадать с форматом файла, иначе декодер не подхватит. */
export function voiceCacheExtensionFromUrl(mediaUrl) {
  try {
    const noQuery = mediaUrl.split('?')[0];
    const base = noQuery.split('/').pop() || '';
    const dot = base.lastIndexOf('.');
    if (dot <= 0 || dot >= base.length - 1) return 'm4a';
    const ext = base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ext || ext.length > 8) return 'm4a';
    const allowed = new Set([
      'm4a',
      'aac',
      'mp3',
      'wav',
      'caf',
      'webm',
      'ogg',
      'opus',
      '3gp',
      'amr']);
    return allowed.has(ext) ? ext : 'm4a';
  } catch {
    return 'm4a';
  }
}

/** Минимальный разумный размер m4a после upload (иначе часто гонка «файл ещё не доступен по public URL»). */
export const VOICE_CACHE_MIN_BYTES = 320;
export const VOICE_CACHE_MAX_ATTEMPTS = 8;
export const VOICE_CACHE_RETRY_MS = 400;

export function normalizeDownloadedFileUri(fileUri) {
  if (
    fileUri &&
    typeof fileUri === 'string' &&
    !/^https?:/i.test(fileUri) &&
    !fileUri.startsWith('file:') &&
    !fileUri.startsWith('content:') &&
    fileUri.startsWith('/')
  ) {
    return `file://${fileUri}`;
  }
  return fileUri;
}

/** Размер с нативного моста / getters: не полагаемся на `typeof === 'number'`. */
function coerceFileSizeBytes(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

export function voiceDownloadedFileSizeBytes(local) {
  let sz = coerceFileSizeBytes(local?.size);
  if (sz > 0) return sz;
  try {
    const uri = normalizeDownloadedFileUri(local?.uri);
    if (!uri || /^https?:/i.test(uri)) return 0;
    const f = new ExpoFile(uri);
    return coerceFileSizeBytes(f.size);
  } catch {
    return 0;
  }
}
