import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Image, Platform } from 'react-native';
import { V } from '../../theme';

const ARIA_AVATAR_SOURCE = require('../../../assets/images/aria_avatar.png');

/** Подзаголовок статуса Aria в шапке чата (точка + текст). null → не рендерим. */
export function AriaPresenceSubtitle({ ariaOnline, isSick }) {
  if (ariaOnline === null) return null;
  const online = ariaOnline === true;
  const sickOnline = online && isSick === true;
  const statusText = sickOnline
    ? 'не очень хорошо себя чувствую...'
    : online
      ? 'онлайн'
      : 'недоступна';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: (2 * 2) / 3,
        minWidth: 0,
        alignSelf: 'stretch',
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
            flex: 1,
            fontSize: 12,
            fontWeight: '400',
            lineHeight: 16,
            color: online ? '#5A9E9A' : V.textMuted,
          },
          Platform.OS === 'android' ? { includeFontPadding: false } : null,
        ]}
        numberOfLines={sickOnline ? 2 : 1}
      >
        {statusText}
      </Text>
    </View>
  );
}

/** Аватар Арии (список чатов, пузыри, индикатор печати). */
export function AriaGradientAvatar({ size = 48, label = 'Ария' }) {
  const r = size / 2;
  return (
    <Image
      source={ARIA_AVATAR_SOURCE}
      style={{ width: size, height: size, borderRadius: r }}
      resizeMode="cover"
      accessibilityLabel={label}
    />
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
