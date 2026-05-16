import { useWindowDimensions } from 'react-native';

/**
 * Ширина, начиная с которой активируется split-режим.
 * Xiaomi Pad 6 (MIUI ~3x density) = 577dp в portrait — ставим 540 как порог.
 * Крупные телефоны не превышают ~430dp, так что зазор безопасный.
 */
export const SPLIT_BREAKPOINT = 540;

/**
 * Возвращает true, если текущая ширина окна ≥ SPLIT_BREAKPOINT.
 * Реагирует на смену ориентации без перезапуска.
 */
export function useIsSplitLayout() {
  const { width } = useWindowDimensions();
  return width >= SPLIT_BREAKPOINT;
}
