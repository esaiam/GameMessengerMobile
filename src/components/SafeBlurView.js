import React from 'react';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Обёртка над BlurView с теми же дефолтами, что были по проекту до отключения blur:
 * Android — blurReductionFactor 4.5 + experimentalBlurMethod dimezisBlurView (как раньше).
 */
export default function SafeBlurView({
  children,
  style,
  intensity,
  tint,
  blurReductionFactor,
  ...rest
}) {
  const brf =
    blurReductionFactor != null
      ? blurReductionFactor
      : Platform.OS === 'android'
        ? 4.5
        : 4;

  return (
    <BlurView
      intensity={intensity ?? 20}
      tint={tint ?? 'dark'}
      blurReductionFactor={brf}
      {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' } : {})}
      style={style}
      {...rest}
    >
      {children}
    </BlurView>
  );
}
