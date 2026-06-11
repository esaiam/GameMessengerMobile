import { Easing } from 'react-native-reanimated';

export const DISMISS_DRAG = 110;
export const DISMISS_VELOCITY = 720;
export const AXIS_LOCK_PX = 10;
export const HANDOFF_FADE_MS = 100;
export const SPRING_BACK = { damping: 22, stiffness: 300, mass: 0.85 };
/** Достаточно медленно, чтобы читался скейл из ячейки. */
export const OPEN_MS = 480;
export const CLOSE_MS = 340;
export const REMEASURE_TIMEOUT_MS = 150;
/** Симметричный in-out — скейл виден и в начале, и в конце. */
export const OPEN_EASING = Easing.inOut(Easing.cubic);
/** Замедление в конце — «посадка» в ячейку без рывка. */
export const CLOSE_EASING = Easing.out(Easing.cubic);
export const PAGE_SPRING = {
  damping: 32,
  stiffness: 220,
  mass: 1,
  restDisplacementThreshold: 0.35,
  restSpeedThreshold: 0.35,
};

export function clampIndex(idx, count) {
  if (count <= 0) return 0;
  return Math.min(Math.max(idx, 0), count - 1);
}
