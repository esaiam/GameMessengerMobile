import { Platform } from 'react-native';

/**
 * Window rect источника hero-перехода (measureInWindow плитки).
 * @typedef {{ x: number, y: number, width: number, height: number }} MediaTransitionRect
 */

/**
 * Эмпирический сдвиг Y: measureInWindow vs видимая ячейка (Android чаще).
 * Close: цель полёта в ячейку. Open: стартовый rect из ячейки.
 */
export const MEDIA_CLOSE_TARGET_BIAS_Y = Platform.OS === 'android' ? 42 : 0;
export const MEDIA_OPEN_SOURCE_BIAS_Y = Platform.OS === 'android' ? 42 : 0;

/** @typedef {(cb: (rect: MediaTransitionRect | null) => void) => void} MeasureTransitionSourceFn */

/**
 * @param {unknown} rect
 * @returns {rect is MediaTransitionRect}
 */
export function isValidMediaTransitionRect(rect) {
  return (
    rect != null &&
    typeof rect === 'object' &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * @param {MediaTransitionRect} rect
 * @returns {MediaTransitionRect}
 */
export function copyMediaTransitionRect(rect) {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Сдвиг window-rect плитки при скролле профиля (contentOffset вырос → y уменьшается).
 * @param {MediaTransitionRect} rect
 * @param {number} scrollDeltaY — currentScrollY - scrollYAtOpen
 */
export function adjustMediaTransitionRectForScroll(rect, scrollDeltaY) {
  if (!Number.isFinite(scrollDeltaY) || scrollDeltaY === 0) return copyMediaTransitionRect(rect);
  return {
    x: rect.x,
    y: rect.y - scrollDeltaY,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Цель close-fly / старт open-fly: пиксельный snap + эмпирический bias по Y.
 * @param {MediaTransitionRect} rect
 * @param {number} biasY
 * @returns {MediaTransitionRect}
 */
function alignTransitionRect(rect, biasY) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y) + biasY,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function alignCloseTargetRect(rect) {
  return alignTransitionRect(rect, MEDIA_CLOSE_TARGET_BIAS_Y);
}

export function alignOpenSourceRect(rect) {
  return alignTransitionRect(rect, MEDIA_OPEN_SOURCE_BIAS_Y);
}
