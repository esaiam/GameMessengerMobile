import React from 'react';
import { FlatList } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useAndroidTabOverscroll } from '../hooks/useAndroidTabOverscroll';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

/**
 * FlatList с bounce на Android для экранов вкладок.
 */
export default function TabOverscrollFlatList({
  overscrollEnabled = true,
  inverted = false,
  suppressTopBounce = false,
  additionalGesture = null,
  onScrollExtra,
  onScroll,
  animated = false,
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

  const ListComponent =
    androidBounce || animated ? AnimatedFlatList : FlatList;
  const scrollOnScroll = androidBounce ? scrollHandler : onScroll;

  const list = (
    <ListComponent
      {...overscrollProps}
      {...rest}
      inverted={inverted}
      style={style}
      onScroll={scrollOnScroll}
      scrollEventThrottle={rest.scrollEventThrottle ?? 16}
    />
  );

  if (!androidBounce) {
    return list;
  }

  const gesture = wrapGesture(additionalGesture);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>{list}</Animated.View>
    </GestureDetector>
  );
}
