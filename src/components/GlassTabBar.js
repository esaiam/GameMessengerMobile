import React, { useContext, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import SafeBlurView from './SafeBlurView';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V, TAB_BAR_LAYOUT } from '../theme';

const DEFAULT_ACTIVE = V.accentSage;
const DEFAULT_INACTIVE = V.textMuted;

/** Круг подсветки за иконкой */
const HIGHLIGHT_SIZE = 44;
const COMPRESS_SCALE = 0.36;
const T_COMPRESS = 90;
const T_MOVE = 140;
const T_EXPAND = 100;

/**
 * «Парящий» таб-бар: закруглённый, с отступами от краёв экрана и эффектом стекла (blur + полупрозрачный тинт).
 */
function tabCenterLeft(layouts, index, size = HIGHLIGHT_SIZE) {
  const L = layouts[index];
  if (!L) return null;
  return L.x + L.width / 2 - size / 2;
}

export default function GlassTabBar({ state, descriptors, navigation, insets: insetsProp }) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const safeInsets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  /** Ширина плашки на 10% меньше: W − 2p′ = 0.9·(W − 2p) ⇒ p′ = 0.05·W + 0.9·p */
  const tabBarHorizontalPad = 0.05 * windowWidth + 0.9 * TAB_BAR_LAYOUT.horizontalPad;

  const [tabLayouts, setTabLayouts] = useState(() => []);
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const iconScaleByKeyRef = useRef({}).current;
  const settledIndexRef = useRef(state.index);
  const layoutDoneRef = useRef(false);
  const runAnimRef = useRef(null);
  const runIconAnimByKeyRef = useRef({}).current;

  const getIconScale = (routeKey) => {
    if (!iconScaleByKeyRef[routeKey]) iconScaleByKeyRef[routeKey] = new Animated.Value(1);
    return iconScaleByKeyRef[routeKey];
  };

  const animateIconPress = (routeKey) => {
    const s = getIconScale(routeKey);
    runIconAnimByKeyRef[routeKey]?.stop?.();
    s.stopAnimation?.();
    s.setValue(1);

    const anim = Animated.sequence([
      Animated.timing(s, {
        toValue: 0.75,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(s, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
    ]);

    runIconAnimByKeyRef[routeKey] = anim;
    anim.start();
  };

  const focused = state.routes[state.index];
  const focusedOptions = descriptors[focused.key].options;
  const flatStyle = StyleSheet.flatten(focusedOptions.tabBarStyle) || {};
  const hidden = flatStyle.display === 'none';

  useLayoutEffect(() => {
    if (hidden) onHeightChange?.(0);
  }, [hidden, onHeightChange]);

  const n = state.routes.length;
  const layoutsReady =
    tabLayouts.length >= n && tabLayouts.slice(0, n).every((L) => L && typeof L.x === 'number');

  useLayoutEffect(() => {
    if (hidden || !layoutsReady) return;

    const idx = state.index;
    const leftTo = tabCenterLeft(tabLayouts, idx);
    if (leftTo == null) return;

    if (!layoutDoneRef.current) {
      translateX.setValue(leftTo);
      scale.setValue(1);
      settledIndexRef.current = idx;
      layoutDoneRef.current = true;
      return;
    }

    const from = settledIndexRef.current;
    if (from === idx) {
      translateX.setValue(leftTo);
      return;
    }

    const leftFrom = tabCenterLeft(tabLayouts, from);
    if (leftFrom == null) {
      translateX.setValue(leftTo);
      settledIndexRef.current = idx;
      return;
    }

    runAnimRef.current?.stop?.();
    translateX.setValue(leftFrom);
    scale.setValue(1);

    const anim = Animated.sequence([
      Animated.timing(scale, {
        toValue: COMPRESS_SCALE,
        duration: T_COMPRESS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: leftTo,
        duration: T_MOVE,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: T_EXPAND,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    runAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) settledIndexRef.current = idx;
    });
  }, [hidden, state.index, layoutsReady, tabLayouts, translateX, scale]);

  if (hidden) return null;

  const bottomPad = Math.max(insetsProp?.bottom ?? safeInsets.bottom, 10);

  const hiRoute = state.routes[state.index];
  const hiActive = descriptors[hiRoute.key].options.tabBarActiveTintColor ?? DEFAULT_ACTIVE;
  const highlightBg =
    hiRoute.name === 'Poker' || hiActive === V.accentGold ? V.gameBubbleBg : V.bgElevated;

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        onHeightChange?.(h);
      }}
      style={{
        paddingHorizontal: tabBarHorizontalPad,
        paddingBottom: bottomPad + TAB_BAR_LAYOUT.floatBottom,
        paddingTop: TAB_BAR_LAYOUT.topPad,
        backgroundColor: 'transparent',
      }}
    >
      <SafeBlurView
        intensity={20}
        tint="dark"
        blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
        style={styles.blurShell}
      >
        <View style={styles.glassTint} pointerEvents="none" />
        <View style={styles.row}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                backgroundColor: highlightBg,
                transform: [{ translateX }, { scale }],
              },
            ]}
          />
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const activeTint = options.tabBarActiveTintColor ?? DEFAULT_ACTIVE;
            const inactiveTint = options.tabBarInactiveTintColor ?? DEFAULT_INACTIVE;
            const color = isFocused ? activeTint : inactiveTint;
            const iconScaleAnim = getIconScale(route.key);

            const onPress = () => {
              animateIconPress(route.key);
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const icon =
              options.tabBarIcon?.({
                focused: isFocused,
                color,
                size: TAB_BAR_LAYOUT.iconSize,
              }) ?? null;

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
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
                <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>{icon}</Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeBlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blurShell: {
    borderRadius: TAB_BAR_LAYOUT.borderRadius,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: V.bgElevated,
    opacity: 0.22,
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
