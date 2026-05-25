/**

 * Межтабовый горизонтальный свайп (Pan на корне). Политика — mainTabPagerGesturePolicy.js.

 */

import React, { useCallback, useMemo } from 'react';

import { View } from 'react-native';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { runOnJS } from 'react-native-reanimated';

import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';
import { resolveNextTabIndex } from './mainTabSwipe';



export function useMainTabSwipeGesture(navRef) {

  const mainTabsNav = useMainTabsNavigationOptional();

  const mainTabSwipeEnabled = mainTabsNav?.mainTabSwipeEnabled ?? true;



  const onSwipeEnd = useCallback((tx, vx) => {

    if (!mainTabSwipeEnabled) return;



    const nav = navRef.current;

    if (!nav) return;



    const idx = mainTabsNav?.getActiveTabIndex?.() ?? -1;

    if (idx < 0) return;



    const nextIdx = resolveNextTabIndex(idx, tx, vx);
    if (nextIdx == null) return;

    mainTabsNav?.switchToTab?.(nextIdx);

  }, [navRef, mainTabsNav, mainTabSwipeEnabled]);



  return useMemo(() => {

    return Gesture.Pan()

      .enabled(mainTabSwipeEnabled)

      .activeOffsetX([-18, 18])

      .failOffsetY([-14, 14])

      .onEnd((e) => {

        runOnJS(onSwipeEnd)(e.translationX ?? 0, e.velocityX ?? 0);

      });

  }, [onSwipeEnd, mainTabSwipeEnabled]);

}



export function MainTabSwipeOverlay({ navRef, children }) {

  const gesture = useMainTabSwipeGesture(navRef);

  const mainTabsNav = useMainTabsNavigationOptional();

  const enabled = mainTabsNav?.mainTabSwipeEnabled ?? true;



  if (!enabled) {

    return (

      <View style={{ flex: 1 }} collapsable={false}>

        {children}

      </View>

    );

  }



  return (

    <GestureDetector gesture={gesture}>

      <View style={{ flex: 1 }} collapsable={false}>

        {children}

      </View>

    </GestureDetector>

  );

}


