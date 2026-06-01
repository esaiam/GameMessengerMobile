import React from 'react';
import { StyleSheet, View } from 'react-native';
import GlassAvatarOverlay from './GlassAvatarOverlay';

/** Лёгкое «выпуклое» увеличение центра под стеклом (круг обрезает края). */
export const AVATAR_LENS_SCALE = 1.078;

/**
 * Круглый клип + масштаб контента + стеклянный overlay.
 */
export function AvatarUnderGlassStack({ size, children }) {
  const radius = size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <View style={styles.lensClip}>
        <View
          style={[
            styles.lensContent,
            {
              width: size,
              height: size,
              transform: [{ scale: AVATAR_LENS_SCALE }],
            },
          ]}
        >
          {children}
        </View>
      </View>
      <GlassAvatarOverlay size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  lensClip: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lensContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
