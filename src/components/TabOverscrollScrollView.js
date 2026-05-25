import React from 'react';
import { ScrollView } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useAndroidTabOverscroll } from '../hooks/useAndroidTabOverscroll';

/**
 * ScrollView с bounce на Android для экранов вкладок.
 */
export default function TabOverscrollScrollView({
  overscrollEnabled = true,
  inverted = false,
  suppressTopBounce = false,
  onScrollExtra,
  onScroll,
  children,
  style,
  ...rest
}) {
  const { androidBounce, scrollHandler, animatedStyle, overscrollProps, wrapGesture } =
    useAndroidTabOverscroll({
      enabled: overscrollEnabled,
      inverted,
      suppressTopBounce,
      onScrollExtra,
    });

  const mergedOnScroll = onScroll ?? scrollHandler;

  const scroll = (
    <ScrollView
      {...overscrollProps}
      {...rest}
      style={style}
      onScroll={androidBounce ? scrollHandler : mergedOnScroll}
      scrollEventThrottle={rest.scrollEventThrottle ?? 16}
    >
      {children}
    </ScrollView>
  );

  if (!androidBounce) {
    return scroll;
  }

  const gesture = wrapGesture(null);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>{scroll}</Animated.View>
    </GestureDetector>
  );
}
