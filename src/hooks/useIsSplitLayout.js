import { useRef } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Ширина, начиная с которой активируется split-режим.
 * Xiaomi Pad 6 (MIUI ~3x density) = 577dp в portrait — ставим 540 как порог.
 * Крупные телефоны не превышают ~430dp, так что зазор безопасный.
 */
export const SPLIT_BREAKPOINT = 540;

/** Гистерезис: сбрасываем split только если окно явно телефонное (не «мигание» при повороте). */
const SPLIT_RELEASE_BELOW = SPLIT_BREAKPOINT - 48;

/**
 * true, если устройство планшетное (короткая сторона ≥ порога).
 * После первого срабатывания «залипает» в true, пока короткая сторона не упадёт
 * заметно ниже порога — иначе при повороте на Android/MIUI бывают кадры с
 * некорректными width/height и split на мгновение выключается.
 */
export function useIsSplitLayout() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const latchedRef = useRef(shortestSide >= SPLIT_BREAKPOINT);

  if (shortestSide >= SPLIT_BREAKPOINT) {
    latchedRef.current = true;
  } else if (shortestSide < SPLIT_RELEASE_BELOW) {
    latchedRef.current = false;
  }

  return latchedRef.current;
}
