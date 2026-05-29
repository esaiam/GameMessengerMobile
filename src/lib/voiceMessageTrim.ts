import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { File as ExpoFile } from 'expo-file-system';
import { cacheDirectory } from 'expo-file-system/legacy';

const TRIM_FULL_EPS = 0.002;

/** MediaMuxer / MediaExtractor на Android — plain path или content://, не Expo `file:/`. */
function toNativeMediaPath(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('content://')) return uri;
  if (uri.startsWith('file://')) {
    const path = uri.slice(7);
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }
  if (uri.startsWith('file:/')) {
    const path = uri.slice(5);
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }
  return uri;
}

export const VOICE_TRIM_NATIVE_UNAVAILABLE = 'native_trim_unavailable';

export type VoiceTrimRange = {
  start: number;
  end: number;
};

type ExtractOptions = {
  video: string;
  output: string;
  format?: 'm4a' | 'wav';
  start?: number;
  duration?: number;
};

type VoiceTrimNativeModule = {
  extractAudio(options: ExtractOptions): Promise<string>;
};

function getVoiceTrimNativeModule(): VoiceTrimNativeModule | null {
  return requireOptionalNativeModule<VoiceTrimNativeModule>('ExpoVideoAudioExtractor');
}

/** Нужна ли нативная обрезка (ручки не на полном диапазоне). */
export function voiceTrimNeedsExport(trim: VoiceTrimRange): boolean {
  const s = Math.max(0, Math.min(1, trim.start));
  const e = Math.max(s, Math.min(1, trim.end));
  return s > TRIM_FULL_EPS || e < 1 - TRIM_FULL_EPS;
}

/**
 * Экспорт фрагмента m4a (AVAsset / MediaMuxer).
 * При полном диапазоне возвращает исходный URI без копирования.
 */
export async function trimVoiceMessageFile(
  sourceUri: string,
  totalDurationSec: number,
  trim: VoiceTrimRange,
): Promise<string> {
  if (!sourceUri || totalDurationSec <= 0) {
    throw new Error('invalid_voice_source');
  }
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  if (!voiceTrimNeedsExport(trim)) {
    return sourceUri;
  }

  const native = getVoiceTrimNativeModule();
  if (!native) {
    throw new Error(VOICE_TRIM_NATIVE_UNAVAILABLE);
  }

  const s = Math.max(0, Math.min(1, trim.start));
  const e = Math.max(s, Math.min(1, trim.end));
  const span = Math.max(0, e - s);
  if (span <= 0) {
    throw new Error('invalid_trim_span');
  }

  const startSec = s * totalDurationSec;
  const durationSec = span * totalDurationSec;
  const cache = cacheDirectory;
  if (!cache) {
    throw new Error('cache_unavailable');
  }
  const fileName = `voice-trim-${Date.now()}.m4a`;
  const outputUri = `${cache}${fileName}`;
  const outputPath = toNativeMediaPath(outputUri);
  const sourcePath = toNativeMediaPath(sourceUri);

  await native.extractAudio({
    video: sourcePath,
    output: outputPath,
    format: 'm4a',
    start: startSec,
    duration: durationSec,
  });

  const outFile = new ExpoFile(outputUri);
  if (!outFile.exists) {
    throw new Error('trim_output_missing');
  }
  return outputUri;
}
