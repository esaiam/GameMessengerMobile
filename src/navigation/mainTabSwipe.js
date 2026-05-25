export const MAIN_TAB_COUNT = 4;

export const MAIN_TAB_SWIPE_MIN_DIST = 70;
export const MAIN_TAB_SWIPE_MIN_VELOCITY = 650;

/** @returns {number | null} */
export function resolveNextTabIndex(currentIdx, tx, vx) {
  const absTx = Math.abs(tx);
  const absVx = Math.abs(vx);
  if (absTx < MAIN_TAB_SWIPE_MIN_DIST && absVx < MAIN_TAB_SWIPE_MIN_VELOCITY) return null;
  const dir = tx === 0 ? (vx < 0 ? -1 : 1) : tx < 0 ? -1 : 1;
  const nextIdx = currentIdx + (dir < 0 ? 1 : -1);
  if (nextIdx < 0 || nextIdx >= MAIN_TAB_COUNT) return null;
  return nextIdx;
}
