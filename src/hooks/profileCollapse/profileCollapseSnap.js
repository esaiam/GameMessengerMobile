/** Snap math: целевая позиция скролла и spring-анимация к ней. */
import {
  cancelAnimation,
  scrollTo,
  withSpring,
} from 'react-native-reanimated';
import {
  COLLAPSE_SNAP_ZONE_EXTRA,
  PROFILE_COLLAPSE_DISTANCE,
  SNAP_COLLAPSE_THRESHOLD,
  SNAP_DRAG_MIN_PX,
  SNAP_EXPAND_THRESHOLD,
  SNAP_REST_MIDPOINT,
  SNAP_SPRING_COLLAPSE,
  SNAP_SPRING_EXPAND,
  SNAP_VELOCITY_COLLAPSE,
  SNAP_VELOCITY_EXPAND,
} from './profileCollapseConstants';

export function snapHeaderSpring(offsetY, scrollRef, scrollY, snapDriving) {
  'worklet';
  cancelAnimation(scrollY);
  snapDriving.value = true;
  const spring = offsetY <= 0 ? SNAP_SPRING_EXPAND : SNAP_SPRING_COLLAPSE;
  scrollY.value = withSpring(offsetY, spring, (finished) => {
    if (finished) {
      snapDriving.value = false;
      scrollTo(scrollRef, 0, offsetY, false);
    }
  });
}

export function calcSnapTarget(y, vy, dragDelta) {
  if (y < 0 || y > PROFILE_COLLAPSE_DISTANCE + COLLAPSE_SNAP_ZONE_EXTRA) return -1;

  const expandLine = PROFILE_COLLAPSE_DISTANCE * (1 - SNAP_EXPAND_THRESHOLD);
  const collapseLine = PROFILE_COLLAPSE_DISTANCE * SNAP_COLLAPSE_THRESHOLD;
  const restLine = PROFILE_COLLAPSE_DISTANCE * SNAP_REST_MIDPOINT;

  const pullExpand = dragDelta < -SNAP_DRAG_MIN_PX;
  const pullCollapse = dragDelta > SNAP_DRAG_MIN_PX;

  let offsetY;

  // Как ProfileScreen: тянем вниз (раскрыть) → vy > 0; asymmetry — верх требует сильнее flick.
  if (vy > SNAP_VELOCITY_EXPAND) {
    offsetY = 0;
  } else if (vy < -SNAP_VELOCITY_COLLAPSE) {
    offsetY = PROFILE_COLLAPSE_DISTANCE;
  } else if (pullExpand) {
    offsetY = y <= expandLine ? 0 : PROFILE_COLLAPSE_DISTANCE;
  } else if (pullCollapse) {
    offsetY = y >= collapseLine ? PROFILE_COLLAPSE_DISTANCE : 0;
  } else {
    offsetY = y >= restLine ? PROFILE_COLLAPSE_DISTANCE : 0;
  }

  if (Math.abs(y - offsetY) < 2) return -1;
  return offsetY;
}
