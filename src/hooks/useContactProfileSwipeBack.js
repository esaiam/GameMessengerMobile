import { Platform } from 'react-native';
import { useMemo, useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

const EDGE_WIDTH = 36;
const SWIPE_BACK_MIN_DIST = 56;
const SWIPE_BACK_MIN_VELOCITY = 420;

/**
 * Свайп вправо от левого края — назад (в чат / предыдущий экран стека).
 */
export function useContactProfileSwipeBack(onBack) {
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  return useMemo(() => {
    if (Platform.OS !== 'android') {
      return null;
    }

    return Gesture.Pan()
        .manualActivation(true)
        .failOffsetX([-9999, -8])
        .onTouchesDown((e) => {
          'worklet';
          const t = e.allTouches[0];
          if (!t) return;
          panStartX.value = t.x;
          panStartY.value = t.y;
        })
        .onTouchesMove((e, state) => {
          'worklet';
          const t = e.allTouches[0];
          if (!t) return;
          if (panStartX.value > EDGE_WIDTH) {
            state.fail();
            return;
          }
          const dx = t.x - panStartX.value;
          const dy = Math.abs(t.y - panStartY.value);
          if (dx < 0) {
            state.fail();
            return;
          }
          if (dx >= 10 && dx > dy * 1.2) {
            state.activate();
          }
        })
        .onEnd((e) => {
          'worklet';
          const tx = e.translationX ?? 0;
          const vx = e.velocityX ?? 0;
          if (tx >= SWIPE_BACK_MIN_DIST || vx >= SWIPE_BACK_MIN_VELOCITY) {
            runOnJS(handleBack)();
          }
        });
  }, [handleBack, panStartX, panStartY]);
}
