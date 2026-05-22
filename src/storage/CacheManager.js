/**
 * Метаданные медиа-кэша (голос + превью видео): LRU, TTL 14 дней, лимит 500 MB.
 * Удаление через expo-file-system File — см. Expo SDK 54 (legacy deleteAsync не используем).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { normalizeDownloadedFileUri } from '../components/chat/voiceCacheUtils';

export const VAULT_CACHE_METADATA_KEY = '@vault_cache_metadata';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
export const VAULT_CACHE_LIMIT_BYTES = 500 * 1024 * 1024;
export const VAULT_CACHE_LIMIT_MB = 500;

/** @type {Set<string>} URI с активным воспроизведением — не удалять при cleanup */
const activePlaybackUris = new Set();

let serialized = Promise.resolve();

function runExclusive(fn) {
  const p = serialized.then(() => fn());
  serialized = p.catch(() => {});
  return p;
}

function normalizeCacheUri(uri) {
  if (!uri || typeof uri !== 'string') return '';
  return normalizeDownloadedFileUri(uri);
}

function documentDirectoryPrefix() {
  try {
    const u = Paths.document?.uri;
    return typeof u === 'string' ? u.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

function cacheDirectoryPrefix() {
  try {
    const u = Paths.cache?.uri;
    return typeof u === 'string' ? u.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

/** Аватар и любые файлы в Documents не трогаем */
export function isProtectedDocumentPath(uri) {
  const n = normalizeCacheUri(uri);
  if (!n) return true;
  const doc = documentDirectoryPrefix();
  if (doc && n.startsWith(doc)) return true;
  if (n.includes('profile_avatar.jpg')) return true;
  return false;
}

function isAllowedCacheDeletionTarget(uri) {
  const n = normalizeCacheUri(uri);
  if (!n || isProtectedDocumentPath(n)) return false;
  const cache = cacheDirectoryPrefix();
  if (cache && n.startsWith(cache)) return true;
  return false;
}

export function registerActivePlaybackUri(uri) {
  const n = normalizeCacheUri(uri);
  if (n) activePlaybackUris.add(n);
}

export function unregisterActivePlaybackUri(uri) {
  const n = normalizeCacheUri(uri);
  if (n) activePlaybackUris.delete(n);
}

function isActivePlayback(uri) {
  const n = normalizeCacheUri(uri);
  return n ? activePlaybackUris.has(n) : false;
}

/**
 * @returns {Promise<{ files: Record<string, { created: number, lastAccessed: number, size: number }> }>}
 */
export async function loadCacheMetadata() {
  try {
    const raw = await AsyncStorage.getItem(VAULT_CACHE_METADATA_KEY);
    if (!raw) return { files: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.files || typeof parsed.files !== 'object') {
      return { files: {} };
    }
    return { files: { ...parsed.files } };
  } catch (e) {
    if (__DEV__) console.warn('[CacheManager] loadCacheMetadata failed:', e?.message || e);
    return { files: {} };
  }
}

export async function saveCacheMetadata(metadata) {
  try {
    const payload = JSON.stringify({
      files: metadata?.files && typeof metadata.files === 'object' ? metadata.files : {} });
    await AsyncStorage.setItem(VAULT_CACHE_METADATA_KEY, payload);
  } catch (e) {
    if (__DEV__) console.warn('[CacheManager] saveCacheMetadata failed:', e?.message || e);
  }
}

export async function recordFileAccess(fileUri, size) {
  const uri = normalizeCacheUri(fileUri);
  if (!uri || isProtectedDocumentPath(uri)) return;
  const sz = typeof size === 'number' && Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0;
  await runExclusive(async () => {
    const meta = await loadCacheMetadata();
    const now = Date.now();
    const prev = meta.files[uri];
    meta.files[uri] = {
      created: prev?.created ?? now,
      lastAccessed: now,
      size: sz > 0 ? sz : prev?.size ?? 0 };
    await saveCacheMetadata(meta);
  });
}

export async function updateFileAccess(fileUri) {
  const uri = normalizeCacheUri(fileUri);
  if (!uri || isProtectedDocumentPath(uri)) return;
  await runExclusive(async () => {
    const meta = await loadCacheMetadata();
    const prev = meta.files[uri];
    const now = Date.now();
    if (!prev) {
      meta.files[uri] = { created: now, lastAccessed: now, size: 0 };
    } else {
      meta.files[uri] = { ...prev, lastAccessed: now };
    }
    await saveCacheMetadata(meta);
  });
}

function totalTrackedBytes(files) {
  return Object.values(files).reduce((acc, e) => acc + (typeof e?.size === 'number' ? e.size : 0), 0);
}

/** Удаляет запись с диска (только cache), возвращает освобождённые байты */
function deleteCacheFilePhysical(uri) {
  const n = normalizeCacheUri(uri);
  if (!isAllowedCacheDeletionTarget(n)) {
    return { freed: 0, ok: false };
  }
  try {
    const f = new ExpoFile(n);
    if (!f.exists) return { freed: 0, ok: false };
    const sz = typeof f.size === 'number' && Number.isFinite(f.size) ? f.size : 0;
    f.delete();
    return { freed: sz, ok: true };
  } catch (e) {
    if (__DEV__) console.warn('[CacheManager] physical delete failed:', n, e?.message || e);
    return { freed: 0, ok: false };
  }
}

/**
 * @param {'cleanup'|'manual'} mode
 */
async function pruneMetadataFiles(meta, mode, /** @type Set<string> */ removedAcc) {
  const files = { ...meta.files };
  const now = Date.now();
  let freedTotal = 0;

  const tryRemove = (uri, reason) => {
    if (isProtectedDocumentPath(uri)) return;
    if (isActivePlayback(uri)) {
      return;
    }
    const { freed, ok } = deleteCacheFilePhysical(uri);
    if (ok) {
      freedTotal += freed;
      removedAcc.add(uri);
      delete files[uri];
    } else {
      try {
        const f = new ExpoFile(normalizeCacheUri(uri));
        if (!f.exists) {
          delete files[uri];
        }
      } catch {
        delete files[uri];
      }
    }
  };

  if (mode === 'cleanup') {
    for (const uri of [...Object.keys(files)]) {
      const entry = files[uri];
      if (!entry) continue;
      const created = typeof entry.created === 'number' ? entry.created : 0;
      if (created > 0 && now - created > FOURTEEN_DAYS_MS) {
        tryRemove(uri, 'age>14d');
      }
    }
  }

  let bytes = totalTrackedBytes(files);
  if (mode === 'cleanup' && bytes <= VAULT_CACHE_LIMIT_BYTES) {
    return { files, freedTotal, removedCount: removedAcc.size };
  }

  const entries = Object.entries(files).map(([uri, e]) => ({
    uri,
    lastAccessed: typeof e?.lastAccessed === 'number' ? e.lastAccessed : 0,
    created: typeof e?.created === 'number' ? e.created : 0 }));

  if (mode === 'manual') {
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
  } else {
    entries.sort((a, b) => {
      if (a.lastAccessed !== b.lastAccessed) return a.lastAccessed - b.lastAccessed;
      return a.created - b.created;
    });
  }

  for (const { uri } of entries) {
    if (bytes <= VAULT_CACHE_LIMIT_BYTES && mode === 'cleanup') break;
    if (!files[uri]) continue;
    tryRemove(uri, mode === 'manual' ? 'manual' : 'LRU');
    bytes = totalTrackedBytes(files);
    if (mode === 'manual') {
      /* всё удаляем по одному до опустошения */
    } else if (bytes <= VAULT_CACHE_LIMIT_BYTES) {
      break;
    }
  }

  return { files, freedTotal, removedCount: removedAcc.size };
}

export async function cleanupCache() {
  return runExclusive(async () => {
    const removedAcc = new Set();
    let meta = await loadCacheMetadata();
    let totalFreed = 0;

    const pass1 = await pruneMetadataFiles(meta, 'cleanup', removedAcc);
    meta = { files: pass1.files };
    totalFreed += pass1.freedTotal;

    await saveCacheMetadata(meta);
    return { removedCount: removedAcc.size, freedBytes: totalFreed };
  });
}

/** Полная очистка отслеживаемого кэша (кроме Documents / активного воспроизведения) */
export async function manualClearCache() {
  return runExclusive(async () => {
    const removedAcc = new Set();
    const meta = await loadCacheMetadata();
    const result = await pruneMetadataFiles(meta, 'manual', removedAcc);
    await saveCacheMetadata({ files: result.files });
    return { removedCount: removedAcc.size, freedBytes: result.freedTotal };
  });
}

export async function getCacheSizeInfo() {
  try {
    const m = await loadCacheMetadata();
    const used = totalTrackedBytes(m.files);
    const usedMB = used / (1024 * 1024);
    return {
      usedMB,
      limitMB: VAULT_CACHE_LIMIT_MB,
      percentUsed: Math.min(100, VAULT_CACHE_LIMIT_BYTES > 0 ? (used / VAULT_CACHE_LIMIT_BYTES) * 100 : 0) };
  } catch {
    return { usedMB: 0, limitMB: VAULT_CACHE_LIMIT_MB, percentUsed: 0 };
  }
}

/** Для экрана «Хранилище»: список файлов с датами */
export async function listCacheEntriesSorted() {
  const m = await loadCacheMetadata();
  return Object.entries(m.files)
    .map(([uri, meta]) => ({
      uri,
      created: meta?.created ?? 0,
      lastAccessed: meta?.lastAccessed ?? 0,
      size: meta?.size ?? 0 }))
    .sort((a, b) => b.lastAccessed - a.lastAccessed);
}
