import React, { useEffect, useState } from 'react';
import { Platform, View, AppState, InteractionManager } from 'react-native';
import { BlurView } from 'expo-blur';
import { V } from '../theme';

/**
 * BlurView с guard на Android: expo-blur падает с MissingActivity,
 * если BlurView attach'ится во время react-native-screens transition.
 * Также отключаем blur при смене layout (`stabilityKey`) и когда `blurEnabled={false}` —
 * иначе dimezisBlurView ловит NPE в PreDrawBlurController при transform/slide.
 */
export default function SafeBlurView({
  children,
  style,
  intensity,
  tint,
  blurReductionFactor,
  fallbackBackgroundColor = V.tabBarGlassTintBg,
  /** false — только fallback View (Android). */
  blurEnabled = true,
  /** Любое изменение пересоздаёт blur после стабилизации layout (Android). */
  stabilityKey,
  ...rest
}) {
  const [androidBlurReady, setAndroidBlurReady] = useState(
    Platform.OS !== 'android' && blurEnabled,
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    let cancelled = false;
    let interactionHandle = null;
    let frameId = null;

    const disableBlur = () => {
      interactionHandle?.cancel?.();
      interactionHandle = null;
      if (frameId != null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      setAndroidBlurReady(false);
    };

    const scheduleBlur = () => {
      interactionHandle?.cancel?.();
      if (frameId != null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }

      if (cancelled || !blurEnabled || AppState.currentState !== 'active') {
        disableBlur();
        return;
      }

      interactionHandle = InteractionManager.runAfterInteractions(() => {
        if (cancelled || !blurEnabled || AppState.currentState !== 'active') return;
        frameId = requestAnimationFrame(() => {
          frameId = null;
          if (cancelled || !blurEnabled || AppState.currentState !== 'active') return;
          setAndroidBlurReady(true);
        });
      });
    };

    disableBlur();
    scheduleBlur();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && blurEnabled) {
        scheduleBlur();
      } else {
        disableBlur();
      }
    });

    return () => {
      cancelled = true;
      disableBlur();
      appStateSub.remove();
    };
  }, [blurEnabled, stabilityKey]);

  const brf =
    blurReductionFactor != null
      ? blurReductionFactor
      : Platform.OS === 'android'
        ? 4.5
        : 4;

  const useFallback =
    Platform.OS === 'android' && (!blurEnabled || !androidBlurReady);

  if (useFallback) {
    return (
      <View
        collapsable={false}
        style={[style, fallbackBackgroundColor ? { backgroundColor: fallbackBackgroundColor } : null]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity ?? 20}
      tint={tint ?? 'dark'}
      blurReductionFactor={brf}
      {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' } : {})}
      style={style}
      collapsable={false}
      {...rest}
    >
      {children}
    </BlurView>
  );
}
