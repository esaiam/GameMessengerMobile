import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Короткий такт в момент старта записи (удержание кнопки микрофона). */
export function triggerRecordStartHaptic() {
  try {
    if (Platform.OS === 'android') {
      // pattern: пауза 0 ms → вибрация 40 ms (надёжнее, чем один number на части OEM)
      Vibration.vibrate([0, 40]);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* ignore */
  }
}
