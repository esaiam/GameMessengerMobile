import { useEffect, useState } from 'react';
import CryptoJS from 'crypto-js';
import { File as ExpoFile, Paths } from 'expo-file-system';
import {
  voiceCacheExtensionFromUrl,
  VOICE_CACHE_MIN_BYTES,
  VOICE_CACHE_MAX_ATTEMPTS,
  VOICE_CACHE_RETRY_MS,
  normalizeDownloadedFileUri,
  voiceDownloadedFileSizeBytes,
} from '../components/chat/voiceCacheUtils';
import { recordFileAccess } from '../storage/CacheManager';

/**
 * Любой HTTPS: качаем в cache `file://` (iOS + Android) — стабильный источник для expo-audio / декодера.
 */
export function useVoicePlayerResolvedUri(
  mediaUrl: string | null | undefined
): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!mediaUrl || typeof mediaUrl !== 'string') return mediaUrl ?? null;
    if (/^https?:\/\//i.test(mediaUrl)) return null;
    return mediaUrl;
  });

  useEffect(() => {
    if (!mediaUrl || typeof mediaUrl !== 'string') {
      setResolved(null);
      return;
    }
    if (!/^https?:\/\//i.test(mediaUrl)) {
      setResolved(mediaUrl);
      return;
    }
    let cancelled = false;
    setResolved(null);
    (async () => {
      try {
        const hash = CryptoJS.SHA256(mediaUrl).toString(CryptoJS.enc.Hex).slice(0, 24);
        const ext = voiceCacheExtensionFromUrl(mediaUrl);
        const dest = new ExpoFile(Paths.cache, `voice-${hash}.${ext}`);
        let fileUri: string | null = null;
        for (let attempt = 0; attempt < VOICE_CACHE_MAX_ATTEMPTS; attempt++) {
          if (cancelled) return;
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, VOICE_CACHE_RETRY_MS));
          }
          const local = await ExpoFile.downloadFileAsync(mediaUrl, dest, { idempotent: true });
          const sz = voiceDownloadedFileSizeBytes(local);
          let u = local.uri;
          u = normalizeDownloadedFileUri(u);
          if (sz >= VOICE_CACHE_MIN_BYTES && u) {
            fileUri = u;
            recordFileAccess(u, sz).catch(() => {});
            break;
          } else if (sz < VOICE_CACHE_MIN_BYTES) {
            try {
              const full = await local.text();
              const preview = full.slice(0, 300);
              console.warn('[voice] small file preview (attempt ' + attempt + '):', preview);
            } catch (readErr: unknown) {
              const msg = readErr instanceof Error ? readErr.message : String(readErr);
              console.warn('[voice] small file, could not read preview:', msg);
            }
          }
        }
        if (!cancelled) {
          if (fileUri) setResolved(fileUri);
          else {
            console.warn('[voice] cache file too small after retries, fallback remote URL');
            setResolved(mediaUrl);
          }
        }
      } catch (e) {
        console.warn('[voice] cache download failed, fallback remote URL:', e);
        if (!cancelled) setResolved(mediaUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaUrl]);

  return resolved;
}
