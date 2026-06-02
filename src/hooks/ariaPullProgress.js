/**
 * Двухфазный pull (как Telegram): сначала rubber-band контента, затем панель Aria 0→1.
 * TOP_PULL_CAP в useChatsSearchReveal = ARIA_RUBBER_BAND_MAX_PX + ARIA_PANEL_TRACK_RANGE_PX.
 */

/** Сырой pull (px), после которого начинает расти панель Aria */
export const ARIA_RUBBER_BAND_MAX_PX = 72;

/** Дистанция pull (px) для полного раскрытия панели после rubber-band */
export const ARIA_PANEL_TRACK_RANGE_PX = 168;

export const ARIA_SNAP_OPEN_THRESHOLD = 0.38;

/** Таб-бар уезжает, когда шторка прошла 1/3 экрана вниз */
export const ARIA_TAB_BAR_HIDE_PROGRESS = 1 / 3;

/** Таб-бар возвращается, когда при закрытии шторка поднялась выше 1/3 */
export const ARIA_TAB_BAR_SHOW_PROGRESS = 1 / 3;

export function cappedRubberBandPullPx(rawPullPx) {
  'worklet';
  return Math.min(Math.max(0, rawPullPx), ARIA_RUBBER_BAND_MAX_PX);
}

export function computeAriaPullProgress(rawPullPx) {
  'worklet';
  if (rawPullPx <= ARIA_RUBBER_BAND_MAX_PX) {
    return 0;
  }
  const beyond = rawPullPx - ARIA_RUBBER_BAND_MAX_PX;
  return Math.min(1, Math.max(0, beyond / ARIA_PANEL_TRACK_RANGE_PX));
}

export function computeAriaGlowIntensity(rawPullPx) {
  'worklet';
  return Math.min(1, Math.max(0, rawPullPx / ARIA_RUBBER_BAND_MAX_PX));
}
