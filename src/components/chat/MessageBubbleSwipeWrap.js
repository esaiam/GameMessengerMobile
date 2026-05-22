import React, { useCallback, useMemo } from 'react';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** Свайп пузырька влево → ответ */
const SWIPE_REPLY_THRESHOLD_PX = 48;
const SWIPE_REPLY_MAX_DRAG_PX = 88;
/** Возврат пузырька на место после отпускания — только timing, без spring */
const SWIPE_REPLY_RESET_MS = 200;

/** Свайп влево: пузырёк следует за пальцем (с лёгким растяжением); отпуск после порога → ответить; без spring */
export default function MessageBubbleSwipeWrap({ children, enabled, isMine, onReply }) {
  const translateX = useSharedValue(0);

  const triggerReply = useCallback(() => {
    onReply();
  }, [onReply]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!enabled)
        .maxPointers(1)
        .activeOffsetX([-16, 16])
        .failOffsetY([-14, 14])
        .onUpdate((e) => {
          const tx = e.translationX;
          if (tx <= 0) {
            translateX.value = Math.max(tx, -SWIPE_REPLY_MAX_DRAG_PX);
          } else {
            translateX.value = 0;
          }
        })
        .onEnd(() => {
          const shouldReply = translateX.value <= -SWIPE_REPLY_THRESHOLD_PX;
          if (shouldReply) {
            runOnJS(triggerReply)();
          }
        })
        .onFinalize(() => {
          translateX.value = withTiming(0, {
            duration: SWIPE_REPLY_RESET_MS,
            easing: Easing.out(Easing.cubic) });
        }),
    [enabled, translateX, triggerReply]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const tx = translateX.value;
    const stretch = Math.min(Math.abs(tx) / 420, 0.045);
    return {
      transform: [{ translateX: tx }, { scaleX: 1 + stretch }] };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View
        style={[{ alignSelf: isMine ? 'flex-end' : 'flex-start' }, animatedStyle]}
      >
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}
