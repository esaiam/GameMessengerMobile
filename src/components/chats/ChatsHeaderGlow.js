import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { tabOverscrollRubberBand } from '../../hooks/useAndroidTabOverscroll';

/** Визуальный pull (px), при котором свечение на максимуме */
const GLOW_PULL_RANGE_PX = 72;
const LIST_AT_TOP_THRESHOLD_PX = 12;

const GLOW_MAX_OPACITY = 2.1 * 2.25;
/** Равномерный scale центра от середины при оверскролле */
const GLOW_CENTER_MAX_SCALE = 8.8;

const GLOW_STOP_CENTER = 0.252;
const GLOW_STOP_MID = 0.098;
const GLOW_CENTER_BOOST_STOP = GLOW_STOP_CENTER;

const GLOW_OFFSET_Y = 10;

function computeGlowPullPx(topPullPx, listScrollY, searchDragActive, androidOverscrollY) {
  'worklet';
  if (listScrollY.value > LIST_AT_TOP_THRESHOLD_PX) {
    return 0;
  }

  let pullPx = tabOverscrollRubberBand(topPullPx.value);

  if (Platform.OS === 'android' && androidOverscrollY && !searchDragActive.value) {
    const topOverscroll = androidOverscrollY.value;
    if (topOverscroll > 0) {
      pullPx = Math.max(pullPx, topOverscroll);
    }
  }

  return pullPx;
}

function computeGlowProgress(topPullPx, listScrollY, searchDragActive, androidOverscrollY) {
  'worklet';
  const pullPx = computeGlowPullPx(
    topPullPx,
    listScrollY,
    searchDragActive,
    androidOverscrollY,
  );
  return interpolate(pullPx, [0, GLOW_PULL_RANGE_PX], [0, 1], Extrapolation.CLAMP);
}

export default function ChatsHeaderGlow({
  topPullPx,
  listScrollY,
  searchDragActive,
  androidOverscrollY,
}) {
  const animatedOuterStyle = useAnimatedStyle(() => {
    const progress = computeGlowProgress(
      topPullPx,
      listScrollY,
      searchDragActive,
      androidOverscrollY,
    );
    return {
      opacity: interpolate(progress, [0, 1], [1, GLOW_MAX_OPACITY], Extrapolation.CLAMP),
    };
  });

  const animatedCenterStyle = useAnimatedStyle(() => {
    const progress = computeGlowProgress(
      topPullPx,
      listScrollY,
      searchDragActive,
      androidOverscrollY,
    );
    const scale = interpolate(
      progress,
      [0, 1],
      [1, GLOW_CENTER_MAX_SCALE],
      Extrapolation.CLAMP,
    );
    return {
      opacity: interpolate(progress, [0, 0.12, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [{ scaleX: scale }, { scaleY: scale }],
    };
  });

  return (
    <View
      style={[
        styles.wrap,
        {
          transform: [{ translateY: GLOW_OFFSET_Y }],
        },
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.layer, animatedOuterStyle]} pointerEvents="none">
        <Svg style={styles.glowSvg} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <RadialGradient id="chatsHeaderGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#5A9E9A" stopOpacity={GLOW_STOP_CENTER} />
              <Stop offset="50%" stopColor="#5A9E9A" stopOpacity={GLOW_STOP_MID} />
              <Stop offset="100%" stopColor="#5A9E9A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="45%" ry="70%" fill="url(#chatsHeaderGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.centerBoost, animatedCenterStyle]} pointerEvents="none">
        <Svg style={styles.glowSvg} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <RadialGradient id="chatsHeaderGlowCenter" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#5A9E9A" stopOpacity={GLOW_CENTER_BOOST_STOP} />
              <Stop offset="45%" stopColor="#5A9E9A" stopOpacity="0" />
              <Stop offset="100%" stopColor="#5A9E9A" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="50%" rx="28%" ry="38%" fill="url(#chatsHeaderGlowCenter)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  glowSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  centerBoost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
