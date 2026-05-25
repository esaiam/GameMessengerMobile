import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions } from 'react-native';
import SafeBlurView from './SafeBlurView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V, TAB_BAR_LAYOUT, TAB_BAR_CAPSULE_RADIUS } from '../theme';

const DEFAULT_ACTIVE = V.accentSage;
const DEFAULT_INACTIVE = V.textMuted;
const HIGHLIGHT_SIZE = 44;
const COMPRESS_SCALE = 0.36;
const T_COMPRESS = 90;
const T_MOVE = 140;
const T_EXPAND = 100;

function tabCenterLeft(layouts, index, size = HIGHLIGHT_SIZE) {
  const L = layouts[index];
  if (!L) return null;
  return L.x + L.width / 2 - size / 2;
}

export default function GlassTabBar({ activeIndex, tabs, onTabPress, visible, bottomInset }) {
  const safeInsets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const tabBarHorizontalPad = 0.05 * windowWidth + 0.9 * TAB_BAR_LAYOUT.horizontalPad;
  const [tabLayouts, setTabLayouts] = useState([]);
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const iconScaleByKeyRef = useRef({}).current;
  const settledIndexRef = useRef(activeIndex);
  const layoutDoneRef = useRef(false);
  const runAnimRef = useRef(null);
  const runIconAnimByKeyRef = useRef({}).current;

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
    if (!visible || !layoutsReady) return;
    const idx = activeIndex;
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
      Animated.timing(scale, { toValue: COMPRESS_SCALE, duration: T_COMPRESS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: leftTo, duration: T_MOVE, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: T_EXPAND, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    runAnimRef.current = anim;
    anim.start(({ finished }) => { if (finished) settledIndexRef.current = idx; });
  }, [visible, activeIndex, layoutsReady, tabLayouts, translateX, scale]);

  if (!visible) return null;

  const bottomPad = Math.max(bottomInset ?? safeInsets.bottom, 10);
  const activeTab = tabs[activeIndex];
  const highlightBg = activeTab?.name === 'Poker' ? V.gameBubbleBg : V.bgElevated;

  return (
    <View
      pointerEvents="box-none"
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
    </View>
  );
}

const styles = StyleSheet.create({
  blurShell: {
    borderRadius: TAB_BAR_CAPSULE_RADIUS,
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
