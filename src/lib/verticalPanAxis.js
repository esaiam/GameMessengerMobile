/** Пороги оси: вертикальный Pan только при явном движении вверх/вниз. */
export const VERTICAL_PAN_FAIL_OFFSET_X = 10;
export const VERTICAL_PAN_ACTIVE_SLOP_Y = 8;
/** dy должен превышать dx минимум на этот множитель. */
export const VERTICAL_PAN_DOMINANCE_RATIO = 1.35;

export function shouldFailHorizontalPan(dx, dy) {
  'worklet';
  return dx > VERTICAL_PAN_FAIL_OFFSET_X && dx >= dy;
}

export function isVerticalDominant(dx, dy) {
  'worklet';
  return (
    dy >= VERTICAL_PAN_ACTIVE_SLOP_Y &&
    dy > dx * VERTICAL_PAN_DOMINANCE_RATIO
  );
}
