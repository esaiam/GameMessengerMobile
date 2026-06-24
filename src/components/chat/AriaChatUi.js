import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, Image, Platform, Easing } from 'react-native';
import Reanimated, {
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { V } from '../../theme';
import { formatAriaStreamPhase } from '../../lib/aria';

const ARIA_AVATAR_SOURCE = require('../../../assets/images/aria_avatar.png');

const SPHERE_SIZE = 48;
const SPHERE_RADIUS = 17;
const SPHERE_COLOR = '#5A9E9A';

/** Симметричные широтные кольца (одинаковые ±lat, равномерный шаг по долготе). */
const SPHERE_RINGS = [
  { latDeg: 0, count: 12, phaseDeg: 0 },
  { latDeg: 38, count: 8, phaseDeg: 22.5 },
  { latDeg: -38, count: 8, phaseDeg: 22.5 },
  { latDeg: 68, count: 4, phaseDeg: 0 },
  { latDeg: -68, count: 4, phaseDeg: 0 },
  { latDeg: 90, count: 1, phaseDeg: 0 },
  { latDeg: -90, count: 1, phaseDeg: 0 },
];

const SPHERE_SPIN_MS = 20000;
const SPHERE_AXIS_ORBIT_MS = 28000;
const SPHERE_DOT_SIZE = 2.8;

function buildSymmetricSphereDots() {
  const dots = [];
  let idx = 0;

  for (const ring of SPHERE_RINGS) {
    const lat = (ring.latDeg * Math.PI) / 180;
    const phase = (ring.phaseDeg * Math.PI) / 180;
    const yNorm = Math.sin(lat);
    const ringRadius = Math.cos(lat);

    for (let i = 0; i < ring.count; i += 1) {
      const angle = phase + ((Math.PI * 2) / ring.count) * i;
      dots.push({
        key: `dot-${idx}`,
        x0: Math.cos(angle) * ringRadius,
        y0: yNorm,
        z0: Math.sin(angle) * ringRadius,
      });
      idx += 1;
    }
  }

  return dots;
}

function rotateSpherePoint(x0, y0, z0, yaw, axisOrbit) {
  'worklet';

  const cosOrbit = Math.cos(axisOrbit);
  const sinOrbit = Math.sin(axisOrbit);
  const x1 = x0;
  const y1 = y0 * cosOrbit - z0 * sinOrbit;
  const z1 = y0 * sinOrbit + z0 * cosOrbit;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  return {
    x: x1 * cosYaw + z1 * sinYaw,
    y: y1,
    z: -x1 * sinYaw + z1 * cosYaw,
  };
}

function AriaSphereDot({ dot, yaw, axisOrbit, cx, cy, radius }) {
  const style = useAnimatedStyle(() => {
    const { x, y, z } = rotateSpherePoint(dot.x0, dot.y0, dot.z0, yaw.value, axisOrbit.value);
    const depth = (z + 1) / 2;

    return {
      position: 'absolute',
      left: cx + x * radius - SPHERE_DOT_SIZE / 2,
      top: cy + y * radius - SPHERE_DOT_SIZE / 2,
      width: SPHERE_DOT_SIZE,
      height: SPHERE_DOT_SIZE,
      borderRadius: SPHERE_DOT_SIZE / 2,
      backgroundColor: SPHERE_COLOR,
      opacity: 0.38 + depth * 0.52,
    };
  });

  return <Reanimated.View style={style} />;
}

/** Пульсирующая сфера из точек — без фона, «висит» до ответа. */
function AriaPulsarSphere() {
  const pulse = useRef(new Animated.Value(0)).current;
  const yaw = useSharedValue(0);
  const axisOrbit = useSharedValue(0);
  const dots = useMemo(() => buildSymmetricSphereDots(), []);
  const cx = SPHERE_SIZE / 2;
  const cy = SPHERE_SIZE / 2;

  useEffect(() => {
    const breatheMs = 4000;
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: breatheMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: breatheMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    yaw.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: SPHERE_SPIN_MS,
        easing: ReanimatedEasing.linear,
      }),
      -1,
      false,
    );
    axisOrbit.value = withRepeat(
      withTiming(Math.PI * 2, {
        duration: SPHERE_AXIS_ORBIT_MS,
        easing: ReanimatedEasing.linear,
      }),
      -1,
      false,
    );
    breathe.start();
    return () => {
      breathe.stop();
    };
  }, [pulse, yaw, axisOrbit]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.1],
  });
  const floatY = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 4],
  });
  const sphereOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.68, 1],
  });

  return (
    <Animated.View
      style={{
        width: SPHERE_SIZE,
        height: SPHERE_SIZE,
        opacity: sphereOpacity,
        transform: [{ translateY: floatY }, { scale }],
      }}
    >
      {dots.map((dot) => (
        <AriaSphereDot
          key={dot.key}
          dot={dot}
          yaw={yaw}
          axisOrbit={axisOrbit}
          cx={cx}
          cy={cy}
          radius={SPHERE_RADIUS}
        />
      ))}
    </Animated.View>
  );
}

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
        alignSelf: 'stretch' }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: online ? V.accentSage : V.textMuted,
          marginRight: 6 }}
      />
      <Text
        style={[
          {
            flex: 1,
            fontSize: 12,
            fontWeight: '400',
            lineHeight: 16,
            color: online ? '#5A9E9A' : V.textMuted
          },
          Platform.OS === 'android' ? { includeFontPadding: false } : null]}
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

/** Три анимированные точки (#5A9E9A). */
function AriaTypingDotRow() {
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
        ]),
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
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {dot(o1)}
      {dot(o2)}
      {dot(o3)}
    </View>
  );
}

/** Три точки «печатает…» (#5A9E9E). */
export function AriaTypingDots() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 }}>
      <AriaTypingDotRow />
    </View>
  );
}

/** Сфера в воздухе + тихая подпись фазы под ней. */
export function AriaTypingIndicator({ phase, hideLabel = false }) {
  const label = formatAriaStreamPhase(phase);
  return (
    <View
      style={{
        alignItems: 'flex-start',
        paddingVertical: 4,
        backgroundColor: 'transparent',
      }}
    >
      <AriaPulsarSphere />
      {!hideLabel ? (
        <Text
          style={{
            marginTop: 8,
            marginLeft: 2,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '400',
            color: SPHERE_COLOR,
            opacity: 0.72,
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
