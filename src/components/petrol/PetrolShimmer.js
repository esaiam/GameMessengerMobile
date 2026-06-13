import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  PETROL_GRADIENT,
  PETROL_GRADIENT_SOFT,
  PETROL_SHIMMER_MS,
} from '../../theme';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const AnimatedSvgGradient = Animated.createAnimatedComponent(SvgLinearGradient);

function usePetrolShift(duration, travel = 72) {
  const shift = useSharedValue(0);

  useEffect(() => {
    shift.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [duration, shift]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: (shift.value - 0.5) * travel }],
  }));
}

function usePetrolGradientShift(duration, travel = 80) {
  const shift = useSharedValue(0);

  useEffect(() => {
    shift.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [duration, shift]);

  return useAnimatedProps(() => ({
    x1: `${interpolate(shift.value, [0, 1], [-travel * 0.5, travel * 0.5])}%`,
    x2: `${interpolate(shift.value, [0, 1], [50, 50 + travel])}%`,
  }));
}

export function PetrolShimmerFill({
  style,
  opacity = 1,
  duration = PETROL_SHIMMER_MS.tab,
  borderRadius = 0,
  soft = false,
  travel = 72,
}) {
  const animStyle = usePetrolShift(duration, travel);
  const gradient = soft ? PETROL_GRADIENT_SOFT : PETROL_GRADIENT;

  return (
    <View
      style={[
        styles.fillClip,
        style,
        { opacity, borderRadius, overflow: 'hidden' },
      ]}
    >
      <AnimatedLinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fillGradient, animStyle]}
      />
    </View>
  );
}

export function PetrolShimmerText({ children, textStyle, opacity = 0.72 }) {
  const label = String(children ?? '');
  const fontSize = textStyle?.fontSize ?? 9;
  const fontWeight = textStyle?.fontWeight ?? '300';
  const letterSpacing = textStyle?.letterSpacing ?? 0;
  const lineHeight = fontSize + 3;
  const approxWidth = Math.ceil(label.length * (fontSize * 0.58) + letterSpacing * label.length + 6);
  const gradientProps = usePetrolGradientShift(PETROL_SHIMMER_MS.text, 48);

  return (
    <View style={[styles.textRoot, { opacity }]}>
      <Svg width={approxWidth} height={lineHeight}>
        <Defs>
          <AnimatedSvgGradient
            id="petrolText"
            gradientUnits="objectBoundingBox"
            animatedProps={gradientProps}
          >
            {PETROL_GRADIENT_SOFT.colors.map((color, index) => (
              <Stop
                key={`${color}-${index}`}
                offset={`${(index / (PETROL_GRADIENT_SOFT.colors.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </AnimatedSvgGradient>
        </Defs>
        <SvgText
          fill="url(#petrolText)"
          fontSize={fontSize}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          x={0}
          y={fontSize}
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fillClip: {
    overflow: 'hidden',
  },
  fillGradient: {
    width: '220%',
    height: '100%',
    marginLeft: '-60%',
  },
  textRoot: {
    alignSelf: 'flex-start',
  },
});
