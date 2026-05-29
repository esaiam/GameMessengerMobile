import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { File as ExpoFile, Paths } from 'expo-file-system';

const TRIM_FULL_EPS = 0.002;

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

/** Нативный модуль есть в dev/release-сборке (не Expo Go и не старый APK). */
export function isVoiceTrimNativeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  return getVoiceTrimNativeModule() != null;
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
  const dest = new ExpoFile(Paths.cache, `voice-trim-${Date.now()}.m4a`);

  await native.extractAudio({
    video: sourceUri,
    output: dest.uri,
    format: 'm4a',
    start: startSec,
    duration: durationSec,
  });

  return dest.uri;
}
