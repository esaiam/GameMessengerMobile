import { RING_HIT_INNER_RATIO } from './videoMessageConstants';

export function runOnPlayer(
  player: { status: string } | null | undefined,
  isAllowed: () => boolean,
  op: () => void,
) {
  if (!player || !isAllowed()) return;
  try {
    if (player.status === 'idle' || player.status === 'error') return;
    op();
  } catch {
    /* native player released */
  }
}

export function touchToProgress01(
  locationX: number,
  locationY: number,
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const angle = Math.atan2(locationY - cy, locationX - cx);
  let p = (angle + Math.PI / 2) / (2 * Math.PI);
  if (p < 0) p += 1;
  return Math.min(1, Math.max(0, p));
}

export function isNearRingEdge(
  locationX: number,
  locationY: number,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return false;
  const cx = width / 2;
  const cy = height / 2;
  const dist = Math.hypot(locationX - cx, locationY - cy);
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * RING_HIT_INNER_RATIO;
  return dist >= innerR && dist <= outerR + 14;
}
