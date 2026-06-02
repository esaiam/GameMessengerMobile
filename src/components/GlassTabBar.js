import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import SafeBlurView from './SafeBlurView';
import { V, TAB_BAR_LAYOUT, TAB_BAR_INNER_ROW_H } from '../theme';

const DEFAULT_ACTIVE = V.accentSage;
const DEFAULT_INACTIVE = V.textMuted;
const HIGHLIGHT_SIZE = TAB_BAR_LAYOUT.activeHighlightSize;
const COMPRESS_SCALE = 0.36;
const T_COMPRESS = 90;
const T_MOVE = 140;
const T_EXPAND = 100;
/** Совпадает с `animationDuration` native-stack в `MainTabsNavigator`. */
const T_VISIBILITY = 200;

function computeTabBarHideOffset(bottomGap) {
  return TAB_BAR_LAYOUT.topPad + TAB_BAR_INNER_ROW_H + bottomGap;
}

function tabCenterLeft(layouts, index, size = HIGHLIGHT_SIZE) {
  const L = layouts[index];
  if (!L) return null;
  return L.x + L.width / 2 - size / 2;
}

export default function GlassTabBar({
  activeIndex,
  tabs,
  onTabPress,
  visible,
  visibilityAnimated = false,
  onVisibilityAnimationEnd,
  ariaTabBarHideSv = null,
  bottomInset,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const tabBarHorizontalPad =
    0.05 * windowWidth
    + 0.9 * TAB_BAR_LAYOUT.horizontalPad
    + (TAB_BAR_LAYOUT.screenSideInsetExtra ?? 0);
  const [tabLayouts, setTabLayouts] = useState([]);
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const iconScaleByKeyRef = useRef({}).current;
  const settledIndexRef = useRef(activeIndex);
  const layoutDoneRef = useRef(false);
  const runAnimRef = useRef(null);
  const runVisibilityRef = useRef(null);
  const runIconAnimByKeyRef = useRef({}).current;
  const visibility = useRef(new Animated.Value(visible ? 0 : 1)).current;
  const prevVisibleRef = useRef(visible);
  const prevVisibilityAnimatedRef = useRef(visibilityAnimated);
  const screenBottomGap = bottomInset ?? TAB_BAR_LAYOUT.screenBottomGap;
  const hideOffsetPx = useRef(
    new Animated.Value(computeTabBarHideOffset(screenBottomGap)),
  ).current;
  const hideOffsetReanimated = useSharedValue(computeTabBarHideOffset(screenBottomGap));
  const ariaTabBarDrive = ariaTabBarHideSv != null;

  useEffect(() => {
    const offset = computeTabBarHideOffset(screenBottomGap);
    hideOffsetReanimated.value = offset;
    if (!visible) return;
    hideOffsetPx.setValue(offset);
  }, [visible, screenBottomGap, hideOffsetPx, hideOffsetReanimated]);

  useEffect(() => {
    if (!visible && !ariaTabBarDrive) {
      runVisibilityRef.current?.stop?.();
      visibility.setValue(1);
      prevVisibleRef.current = false;
    }
  }, [visible, ariaTabBarDrive, visibility]);

  useEffect(() => {
    if (ariaTabBarDrive) {
      if (!visibilityAnimated) {
        visibility.setValue(visible ? 0 : 1);
      }
      return undefined;
    }

    const toValue = visible ? 0 : 1;
    const visibleChanged = prevVisibleRef.current !== visible;
    const animatedModeChanged = prevVisibilityAnimatedRef.current !== visibilityAnimated;
    prevVisibleRef.current = visible;
    prevVisibilityAnimatedRef.current = visibilityAnimated;

    if (!visibilityAnimated && !visibleChanged && animatedModeChanged) {
      return undefined;
    }

    runVisibilityRef.current?.stop?.();
    if (!visibilityAnimated) {
      if (visibleChanged) {
        visibility.setValue(toValue);
        onVisibilityAnimationEnd?.({ finished: true, visible });
      }
      return undefined;
    }
    const anim = Animated.timing(visibility, {
      toValue,
      duration: T_VISIBILITY,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    runVisibilityRef.current = anim;
    anim.start(({ finished }) => {
      onVisibilityAnimationEnd?.({ finished: !!finished, visible });
    });
    return () => anim.stop();
  }, [
    ariaTabBarDrive,
    visible,
    visibilityAnimated,
    visibility,
    onVisibilityAnimationEnd,
  ]);

  const ariaShellStyle = useAnimatedStyle(() => {
    if (!ariaTabBarHideSv) {
      return {};
    }
    const hideFactor = visible ? ariaTabBarHideSv.value : 1;
    return {
      transform: [
        { translateY: hideOffsetReanimated.value * hideFactor },
      ],
    };
  }, [ariaTabBarHideSv, hideOffsetReanimated, visible]);

  const getIconScale = (key) => {
    if (!iconScaleByKeyRef[key]) iconScaleByKeyRef[key] = new Animated.Value(1);
    return iconScaleByKeyRef[key];
  };

  const animateIconPress = (key) => {
    const s = getIconScale(key);
    runIconAnimByKeyRef[key]?.stop?.();
    s.stopAnimation?.();
    s.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(s, { toValue: 0.75, duration: 100, useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]);
    runIconAnimByKeyRef[key] = anim;
    anim.start();
  };

  const n = tabs.length;
  const layoutsReady =
    tabLayouts.length >= n && tabLayouts.slice(0, n).every((L) => L && typeof L.x === 'number');

  useLayoutEffect(() => {
    if (!layoutsReady) return;
    const idx = activeIndex;
    const leftTo = tabCenterLeft(tabLayouts, idx);
    if (leftTo == null) return;

    const snapHighlightTo = (left) => {
      runAnimRef.current?.stop?.();
      translateX.setValue(left);
      scale.setValue(1);
    };

    if (!layoutDoneRef.current) {
      snapHighlightTo(leftTo);
      settledIndexRef.current = idx;
      layoutDoneRef.current = true;
      return;
    }

    const from = settledIndexRef.current;
    if (from === idx) {
      translateX.setValue(leftTo);
      return;
    }

    if (!visible) {
      snapHighlightTo(leftTo);
      settledIndexRef.current = idx;
      return;
    }

    const leftFrom = tabCenterLeft(tabLayouts, from);
    if (leftFrom == null) {
      snapHighlightTo(leftTo);
      settledIndexRef.current = idx;
      return;
    }

    runAnimRef.current?.stop?.();
    translateX.setValue(leftFrom);
    scale.setValue(1);
    const anim = Animated.sequence([
      Animated.timing(scale, { toValue: COMPRESS_SCALE, duration: T_COMPRESS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: leftTo, duration: T_MOVE, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: T_EXPAND, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    runAnimRef.current = anim;
    anim.start(({ finished }) => { if (finished) settledIndexRef.current = idx; });
  }, [visible, activeIndex, layoutsReady, tabLayouts, translateX, scale]);

  const activeTab = tabs[activeIndex];
  const highlightBg = activeTab?.name === 'Poker' ? V.gameBubbleBg : V.bgElevated;
  const slideY = ariaTabBarDrive ? null : Animated.multiply(visibility, hideOffsetPx);

  const shellPadding = {
    paddingHorizontal: tabBarHorizontalPad,
    paddingBottom: screenBottomGap,
    paddingTop: TAB_BAR_LAYOUT.topPad,
  };

  const handleShellLayout = (h) => {
    if (h > 0) {
      hideOffsetReanimated.value = h;
      if (visible) {
        hideOffsetPx.setValue(h);
      }
    }
  };

  const tabBarBody = (
    <SafeBlurView
      intensity={20}
      tint="dark"
      blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
      style={styles.tabBarShell}
    >
      <View style={styles.glassTint} pointerEvents="none" />
      <View style={styles.row}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            { backgroundColor: highlightBg, transform: [{ translateX }, { scale }] },
          ]}
        />
        {tabs.map((tab, index) => {
          const isFocused = activeIndex === index;
          const color = isFocused ? (tab.activeTint ?? DEFAULT_ACTIVE) : DEFAULT_INACTIVE;
          const iconScaleAnim = getIconScale(tab.key);
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={() => { animateIconPress(tab.key); onTabPress(index); }}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setTabLayouts((prev) => {
                  const next = [...prev];
                  while (next.length < n) next.push(null);
                  next[index] = { x, width };
                  return next;
                });
              }}
              style={styles.tab}
              activeOpacity={0.75}
            >
              <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
                {tab.icon(color)}
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeBlurView>
  );

  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {ariaTabBarDrive ? (
        <Reanimated.View
          onLayout={(e) => {
            handleShellLayout(e.nativeEvent.layout.height);
          }}
          style={[styles.shell, shellPadding, ariaShellStyle]}
        >
          {tabBarBody}
        </Reanimated.View>
      ) : (
        <Animated.View
          onLayout={(e) => {
            handleShellLayout(e.nativeEvent.layout.height);
          }}
          style={[
            styles.shell,
            shellPadding,
            slideY != null ? { transform: [{ translateY: slideY }] } : null,
          ]}
        >
          {tabBarBody}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: 'transparent',
  },
  tabBarShell: {
    height: TAB_BAR_LAYOUT.shellHeight,
    borderTopLeftRadius: TAB_BAR_LAYOUT.topCornerRadius,
    borderTopRightRadius: TAB_BAR_LAYOUT.topCornerRadius,
    borderBottomLeftRadius: TAB_BAR_LAYOUT.bottomCornerRadius,
    borderBottomRightRadius: TAB_BAR_LAYOUT.bottomCornerRadius,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.tabBarShellBorder,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: V.tabBarGlassTintBg,
  },
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: TAB_BAR_LAYOUT.rowPaddingV,
    paddingHorizontal: TAB_BAR_LAYOUT.rowPaddingH,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    width: HIGHLIGHT_SIZE,
    height: HIGHLIGHT_SIZE,
    borderRadius: HIGHLIGHT_SIZE / 2,
    top: TAB_BAR_LAYOUT.rowPaddingV + TAB_BAR_LAYOUT.iconSize / 2 - HIGHLIGHT_SIZE / 2,
    zIndex: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
