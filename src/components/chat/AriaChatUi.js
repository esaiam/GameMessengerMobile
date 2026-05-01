import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { V } from '../../theme';

/** Подзаголовок статуса Aria в шапке чата (точка + текст). null → не рендерим. */
export function AriaPresenceSubtitle({ ariaOnline }) {
  if (ariaOnline === null) return null;
  const online = ariaOnline === true;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: (2 * 2) / 3,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: online ? V.accentSage : V.textMuted,
          marginRight: 6,
        }}
      />
      <Text
        style={[
          {
            fontSize: 12,
            fontWeight: '400',
            lineHeight: 16,
            color: online ? '#5A9E9A' : V.textMuted,
          },
          Platform.OS === 'android' ? { includeFontPadding: false } : null,
        ]}
      >
        {online ? 'онлайн' : 'недоступна'}
      </Text>
    </View>
  );
}

/** Градиентный аватар Aria (как в списке чатов). */
export function AriaGradientAvatar({ size = 48, label = 'A' }) {
  const r = size / 2;
  return (
    <LinearGradient
      colors={[V.accentSage, '#3d7a76']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.29), fontWeight: '500', color: V.textPrimary }}>
        {label}
      </Text>
    </LinearGradient>
  );
}

/** Три точки «печатает…» (#5A9E9A). */
export function AriaTypingDots() {
  const o1 = useRef(new Animated.Value(0.35)).current;
  const o2 = useRef(new Animated.Value(0.35)).current;
  const o3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const mk = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
        ])
      );
    const a1 = mk(o1, 0);
    const a2 = mk(o2, 120);
    const a3 = mk(o3, 240);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [o1, o2, o3]);

  const dot = (anim) => (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        marginHorizontal: 3,
        backgroundColor: V.accentSage,
        opacity: anim,
      }}
    />
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 }}>
      {dot(o1)}
      {dot(o2)}
      {dot(o3)}
    </View>
  );
}
