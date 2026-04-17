import { setAudioModeAsync as expoSetAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Android native module не принимает строку для interruptionMode — ожидает Kotlin enum,
 * каст падает с IllegalArgumentException. На Android просто не передаём это поле.
 */
export async function setAudioModeAsync(mode) {
  if (Platform.OS === 'android') {
    // eslint-disable-next-line no-unused-vars
    const { interruptionMode, ...rest } = mode;
    return expoSetAudioModeAsync(rest);
  }
  return expoSetAudioModeAsync(mode);
}
