import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function useMessageRowSelectionBounce(isSelected) {
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const bounceAnimVideo = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSelected) {
      bounceAnim.setValue(1.04);
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 6,
        tension: 160,
        useNativeDriver: true,
      }).start();
      bounceAnimVideo.setValue(1.04);
      Animated.spring(bounceAnimVideo, {
        toValue: 1,
        friction: 6,
        tension: 160,
        useNativeDriver: false,
      }).start();
    }
  }, [isSelected, bounceAnim, bounceAnimVideo]);

  return { bounceAnim, bounceAnimVideo };
}
