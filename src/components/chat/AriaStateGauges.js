import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {

  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming } from 'react-native-reanimated';

const MOCK_STATE = {
  mood: 0.6, // bipolar -1..1
  hurt: 0.15, // unipolar 0..1
  boredom: 0.2, // unipolar 0..1
  energy: 0.75, // unipolar 0..1
  trust: 0.3, // bipolar -1..1
};

const SEGMENTS = 28;
const GAP_DEG = 7;
const ARC_START_DEG = -225;
const ARC_TOTAL_DEG = 270;
const INACTIVE_FILL = 'rgba(255,255,255,0.18)';

const ZONE_H_COLLAPSED = 48;
const ZONE_H_EXPANDED = 72;

const CENTER_SIZE_COLLAPSED = 34;
const CENTER_SIZE_EXPANDED = 56;
const SIDE_SIZE = 56;
const ITEM_W = 62;

const BACK_EASING = Easing.out(Easing.back(1.5));

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampBipolar(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function hexToRgb(hex) {
  const h = typeof hex === 'string' ? hex.trim() : '';
  if (!h.startsWith('#') || (h.length !== 7 && h.length !== 4)) return [255, 255, 255];
  if (h.length === 4) {
    const r = parseInt(h[1] + h[1], 16);
    const g = parseInt(h[2] + h[2], 16);
    const b = parseInt(h[3] + h[3], 16);
    return [r, g, b];
  }
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function lerpColor(c1, c2, t) {
  const tt = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  const r = Math.round(r1 + (r2 - r1) * tt);
  const g = Math.round(g1 + (g2 - g1) * tt);
  const b = Math.round(b1 + (b2 - b1) * tt);
  return `rgb(${r},${g},${b})`;
}

function segPath(a1Deg, a2Deg, rI, rO, cx, cy) {
  const A1 = (a1Deg * Math.PI) / 180;
  const A2 = (a2Deg * Math.PI) / 180;
  const x1 = cx + rO * Math.cos(A1);
  const y1 = cy + rO * Math.sin(A1);
  const x2 = cx + rO * Math.cos(A2);
  const y2 = cy + rO * Math.sin(A2);
  const x3 = cx + rI * Math.cos(A2);
  const y3 = cy + rI * Math.sin(A2);
  const x4 = cx + rI * Math.cos(A1);
  const y4 = cy + rI * Math.sin(A1);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${rO},${rO} 0 0,1 ${x2.toFixed(
    2
  )},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${rI},${rI} 0 0,0 ${x4.toFixed(
    2
  )},${y4.toFixed(2)} Z`;
}

function buildSegments({
  bipolar,
  val,
  posC,
  negC,
  size }) {
  const step = ARC_TOTAL_DEG / SEGMENTS;
  const halfGap = GAP_DEG / 2;
  const cx = size / 2;
  const cy = size / 2;
  const rO = size * 0.415;
  const rI = size * 0.295;

  if (!bipolar) {
    const v01 = clamp01(val);
    const fill = Math.round(v01 * SEGMENTS);
    const segs = [];
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a1 = ARC_START_DEG + i * step + halfGap;
      const a2 = ARC_START_DEG + i * step + step - halfGap;
      const active = i < fill;
      const t = fill > 1 ? i / (fill - 1) : 0;
      segs.push({
        d: segPath(a1, a2, rI, rO, cx, cy),
        fill: active ? lerpColor(posC[0], posC[1], t) : INACTIVE_FILL });
    }
    return segs;
  }

  const vb = clampBipolar(val);
  const half = Math.floor(SEGMENTS / 2);
  const mid = half;
  const posFill = Math.round(Math.max(0, vb) * half);
  const negFill = Math.round(Math.max(0, -vb) * half);

  const segs = [];
  for (let i = 0; i < SEGMENTS; i += 1) {
    const a1 = ARC_START_DEG + i * step + halfGap;
    const a2 = ARC_START_DEG + i * step + step - halfGap;

    let fill = INACTIVE_FILL;
    if (i >= mid && i < mid + posFill) {
      const t = posFill > 1 ? (i - mid) / (posFill - 1) : 0;
      fill = lerpColor(posC[0], posC[1], t);
    } else if (i < mid && i >= mid - negFill) {
      const t = negFill > 1 ? (mid - 1 - i) / (negFill - 1) : 0;
      fill = lerpColor(negC[0], negC[1], t);
    }

    segs.push({
      d: segPath(a1, a2, rI, rO, cx, cy),
      fill });
  }
  return segs;
}

function Gauge({
  size,
  bipolar,
  val,
  posEmoji,
  negEmoji,
  posC,
  negC,
  emojiFontSize }) {
  const emoji = !bipolar || clampBipolar(val) >= 0 ? posEmoji : negEmoji || posEmoji;
  const segments = useMemo(
    () =>
      buildSegments({
        bipolar,
        val,
        posC,
        negC,
        size }),
    [bipolar, val, posC, negC, size]
  );

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, idx) => (
          <Path key={idx} d={s.d} fill={s.fill} />
        ))}
      </Svg>
      <View pointerEvents="none" style={styles.emojiWrap}>
        <Text
          style={[
            styles.emoji,
            { fontSize: emojiFontSize },
            Platform.OS === 'android' ? { includeFontPadding: false } : null]}
        >
          {emoji}
        </Text>
      </View>
    </View>
  );
}

export default function AriaStateGauges({ state, onHeightChange }) {
  // Пока мок: если проп не передан — показываем MOCK_STATE.
  // Когда будет fetch: передавайте `state={null}` на время загрузки, чтобы увидеть нейтральные значения.
  const s = typeof state === 'undefined' ? MOCK_STATE : state;
  const values = {
    boredom: clamp01(s?.boredom ?? 0),
    hurt: clamp01(s?.hurt ?? 0),
    mood: clampBipolar(s?.mood ?? 0),
    energy: clamp01(s?.energy ?? 0),
    trust: clampBipolar(s?.trust ?? 0) };

  const [expanded, setExpanded] = useState(false);
  const open = useSharedValue(0);
  const openTarget = useSharedValue(0);
  const sideM2 = useSharedValue(0);
  const sideM1 = useSharedValue(0);
  const sideP1 = useSharedValue(0);
  const sideP2 = useSharedValue(0);

  useEffect(() => {
    onHeightChange?.(ZONE_H_COLLAPSED);
  }, [onHeightChange]);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      onHeightChange?.(next ? ZONE_H_EXPANDED : ZONE_H_COLLAPSED);
      openTarget.value = next ? 1 : 0;
      open.value = withTiming(next ? 1 : 0, { duration: 450, easing: BACK_EASING });

      if (next) {
        sideM1.value = withDelay(60, withTiming(1, { duration: 420, easing: BACK_EASING }));
        sideP1.value = withDelay(60, withTiming(1, { duration: 420, easing: BACK_EASING }));
        sideM2.value = withDelay(120, withTiming(1, { duration: 420, easing: BACK_EASING }));
        sideP2.value = withDelay(120, withTiming(1, { duration: 420, easing: BACK_EASING }));
      } else {
        sideM2.value = withDelay(0, withTiming(0, { duration: 320, easing: BACK_EASING }));
        sideP2.value = withDelay(0, withTiming(0, { duration: 320, easing: BACK_EASING }));
        sideM1.value = withDelay(60, withTiming(0, { duration: 320, easing: BACK_EASING }));
        sideP1.value = withDelay(60, withTiming(0, { duration: 320, easing: BACK_EASING }));
      }
      return next;
    });
  }, [open, openTarget, sideM2, sideM1, sideP1, sideP2, onHeightChange]);

  const zoneStyle = useAnimatedStyle(() => ({
    height: interpolate(open.value, [0, 1], [ZONE_H_COLLAPSED, ZONE_H_EXPANDED]) }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(open.value, [0, 1], [0, 1]) }],
    borderRadius: interpolate(open.value, [0, 1], [999, 0]) }));

  const centerScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(open.value, [0, 1], [CENTER_SIZE_COLLAPSED / CENTER_SIZE_EXPANDED, 1]) }] }));

  function SideGauge({ pos, v, children }) {
    const animStyle = useAnimatedStyle(() => ({
      opacity: v.value,
      transform: [
        { translateX: interpolate(v.value, [0, 1], [0, pos * ITEM_W]) },
        { scale: interpolate(v.value, [0, 1], [0.3, 1]) }] }));
    return <Animated.View style={[styles.sideSlot, animStyle]}>{children}</Animated.View>;
  }

  return (
    <Animated.View style={[styles.zone, zoneStyle]}>
      <Animated.View pointerEvents="none" style={[styles.bg, bgStyle]} />

      <View pointerEvents="box-none" style={styles.row}>
        {/* Скука (-2) */}
        <SideGauge pos={-2} v={sideM2}>
          <Gauge
            size={SIDE_SIZE}
            bipolar={false}
            val={values.boredom}
            posEmoji="😑"
            posC={['#8BA8BE', '#2C4A6E']}
            negC={['#8BA8BE', '#2C4A6E']}
            emojiFontSize={14}
          />
        </SideGauge>

        {/* Боль (-1) */}
        <SideGauge pos={-1} v={sideM1}>
          <Gauge
            size={SIDE_SIZE}
            bipolar={false}
            val={values.hurt}
            posEmoji="😤"
            posC={['#FF4444', '#CC0000']}
            negC={['#FF4444', '#CC0000']}
            emojiFontSize={14}
          />
        </SideGauge>

        {/* Энергия (+1) */}
        <SideGauge pos={1} v={sideP1}>
          <Gauge
            size={SIDE_SIZE}
            bipolar={false}
            val={values.energy}
            posEmoji="⚡"
            posC={['#FF5E5E', '#FFE566']}
            negC={['#FF5E5E', '#FFE566']}
            emojiFontSize={14}
          />
        </SideGauge>

        {/* Доверие (+2) */}
        <SideGauge pos={2} v={sideP2}>
          <Gauge
            size={SIDE_SIZE}
            bipolar={true}
            val={values.trust}
            posEmoji="🤝"
            negEmoji="👁️"
            posC={['#F0B429', '#FFE87A']}
            negC={['#C9A84C', '#7A5200']}
            emojiFontSize={14}
          />
        </SideGauge>
      </View>

      <Pressable onPress={toggle} hitSlop={8} style={styles.centerPress}>
        <Animated.View style={centerScaleStyle}>
          <Gauge
            size={CENTER_SIZE_EXPANDED}
            bipolar={true}
            val={values.mood}
            posEmoji="😊"
            negEmoji="😢"
            posC={['#40E0D0', '#C8FFE8']}
            negC={['#5A9E9A', '#1E5B9E']}
            emojiFontSize={expanded ? 14 : 16}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zone: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible' },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)' },
  row: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none' },
  sideSlot: {
    position: 'absolute',
    left: '50%',
    marginLeft: -ITEM_W / 2,
    width: ITEM_W,
    alignItems: 'center',
    justifyContent: 'center' },
  centerPress: {
    position: 'relative',
    zIndex: 2 },
  emojiWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center' },
  emoji: {
    lineHeight: 18,
    fontWeight: '400',
    transform: [{ translateY: -1 }]
  } });

