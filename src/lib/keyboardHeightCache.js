import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions, Platform } from 'react-native';
import { EMOJI_PICKER_PANEL_H } from '../components/chat/chatComposerConstants';

const STORAGE_KEY = 'vault:soft_keyboard_height_px';
const MIN_KB_H = 200;
const MAX_KB_H = 520;

/** Оценка высоты soft-keyboard до первого реального показа. */
export function estimateKeyboardHeight(windowHeight = Dimensions.get('window').height) {
  const ratio = Platform.OS === 'ios' ? 0.36 : 0.38;
  const estimated = Math.round(windowHeight * ratio);
  return Math.min(MAX_KB_H, Math.max(MIN_KB_H, estimated));
}

export function clampKeyboardHeight(h) {
  const n = Math.round(Number(h));
  if (!Number.isFinite(n) || n < MIN_KB_H) return null;
  return Math.min(MAX_KB_H, n);
}

export async function loadCachedKeyboardHeight() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return null;
    return clampKeyboardHeight(parseFloat(raw, 10));
  } catch {
    return null;
  }
}

export async function saveCachedKeyboardHeight(h) {
  const clamped = clampKeyboardHeight(h);
  if (clamped == null) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}

/** Кэш → эвристика → константа панели. */
export async function resolveKeyboardPanelHeight() {
  const cached = await loadCachedKeyboardHeight();
  if (cached != null) return cached;
  const estimated = estimateKeyboardHeight();
  if (estimated >= MIN_KB_H) return estimated;
  return EMOJI_PICKER_PANEL_H;
}
