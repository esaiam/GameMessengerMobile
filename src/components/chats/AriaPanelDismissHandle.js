import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { V } from '../../theme';

const DISMISS_CLOSE_THRESHOLD = 0.78;
const DISMISS_CLOSE_VELOCITY_Y = -900;
const COMMIT_SPRING = { damping: 22, stiffness: 240, mass: 0.85 };

/**
 * Ползунок под полем ввода: тянуть вверх — закрыть шторку (pullProgress).
 */
export default function AriaPanelDismissHandle({
  pullProgress,
  curtainMaxHeightSv,
  committedSv,
  onClose,
  pointerEvents = 'auto',
  style,
}) {
  const dismissStart = useSharedValue(1);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(-4)
        .failOffsetX([-20, 20])
        .onStart(() => {
          'worklet';
          if (committedSv.value <= 0.5) {
            return;
          }
          dismissStart.value = pullProgress.value;
        })
        .onUpdate((e) => {
          'worklet';
          if (committedSv.value <= 0.5) {
            return;
          }
          const maxH = curtainMaxHeightSv.value;
          if (maxH <= 0) {
            return;
          }
          pullProgress.value = Math.max(
            0,
            Math.min(1, dismissStart.value + e.translationY / maxH),
          );
        })
        .onEnd((e) => {
          'worklet';
          if (committedSv.value <= 0.5) {
            return;
          }
          const shouldDismiss =
            pullProgress.value < DISMISS_CLOSE_THRESHOLD ||
            (e.velocityY != null && e.velocityY < DISMISS_CLOSE_VELOCITY_Y);
          if (shouldDismiss) {
            runOnJS(onClose)();
            return;
          }
          pullProgress.value = withSpring(1, COMMIT_SPRING);
        }),
    [committedSv, curtainMaxHeightSv, onClose, dismissStart, pullProgress],
  );

  const trackStyle = useAnimatedStyle(() => {
    const open = committedSv.value > 0.5;
    return { opacity: open ? 1 : 0 };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        pointerEvents={pointerEvents}
        style={[styles.hitArea, style, trackStyle]}
        accessibilityRole="adjustable"
        accessibilityLabel="Закрыть панель Арии"
        accessibilityHint="Потяни вверх, чтобы свернуть"
      >
        <View style={styles.grabPill} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 10,
  },
  grabPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: V.textMuted,
    opacity: 0.85,
  },
});
