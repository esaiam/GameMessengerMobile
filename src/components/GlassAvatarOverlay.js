import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { V } from '../theme';

/**
 * Прозрачный «иллюминатор» поверх круглого аватара: выпуклое стекло, лёгкий блик.
 * Фото / инициалы — задний слой; overlay не перехватывает нажатия.
 */
export default function GlassAvatarOverlay({ size }) {
  const radius = size / 2;
  const topSheenH = Math.max(6, Math.round(size * 0.38));
  const specularW = Math.max(8, Math.round(size * 0.34));
  const specularH = Math.max(6, Math.round(specularW * 0.65));
  const bottomDepthH = Math.max(5, Math.round(size * 0.22));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: V.glassNeutralBg, opacity: 0.22 },
        ]}
      />

      <LinearGradient
        colors={[
          'rgba(255,255,255,0.07)',
          'rgba(255,255,255,0.02)',
          'transparent',
          'rgba(0,0,0,0.05)',
        ]}
        locations={[0, 0.3, 0.65, 1]}
        start={{ x: 0.1, y: 0.08 }}
        end={{ x: 0.9, y: 0.94 }}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={[V.glassCapsuleInnerSheen, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          left: size * 0.1,
          right: size * 0.1,
          height: topSheenH,
          opacity: 0.38,
        }}
      />

      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          top: size * 0.07,
          left: size * 0.12,
          width: specularW,
          height: specularH,
          borderRadius: specularW,
          opacity: 0.28,
        }}
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.10)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: bottomDepthH,
          opacity: 0.42,
        }}
      />

      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: V.glassCapsuleEdgeBR,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: size * 0.48,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderWidth: StyleSheet.hairlineWidth,
          borderBottomWidth: 0,
          borderColor: V.glassCapsuleEdgeTL,
          opacity: 0.5,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
});
