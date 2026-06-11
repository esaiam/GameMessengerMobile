import {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import {
  ACTIONS_PARALLAX_FAST,
  ACTIONS_PARALLAX_SLOW,
  AVATAR_BORDER_SAGE,
  AVATAR_BORDER_SAGE_PEAK,
  AVATAR_GLOW_FILL_MAX,
  AVATAR_GLOW_HEADER_PEAK_SCROLL,
  AVATAR_GLOW_RING_OPACITY_RAMP,
  AVATAR_GLOW_RING_RAMP,
  AVATAR_GLOW_RING_SCALE_RAMP,
  AVATAR_GLOW_SCROLL_PEAK,
  PROFILE_COLLAPSE_DISTANCE,
} from './profileCollapseConstants';
import { avatarGlowIntensity, avatarGlowTailFade } from './profileCollapseWorklets';

/**
 * Parallax + animated styles аватара и glow rings.
 * @param {{ scrollY: import('react-native-reanimated').SharedValue<number>, collapseP: import('react-native-reanimated').DerivedValue<number>, withAvatarScrollGlow: boolean, avatarLiftY: number }} options
 */
export function useProfileCollapseAvatarStyles({
  scrollY,
  collapseP,
  withAvatarScrollGlow,
  avatarLiftY,
}) {
  /** Профиль контакта: 0→80px вполскорости, затем догоняет контент до collapse. */
  const avatarParallaxY = useDerivedValue(() => {
    if (!withAvatarScrollGlow) return 0;
    const y = scrollY.value;
    if (y <= AVATAR_GLOW_SCROLL_PEAK) {
      return -y * 0.5;
    }
    return -AVATAR_GLOW_SCROLL_PEAK * 0.5 - (y - AVATAR_GLOW_SCROLL_PEAK) * 1.5;
  });

  /** Кнопки над аватаром: быстрее уходят под шапку (parallax). */
  const actionsParallaxY = useDerivedValue(() => {
    if (!withAvatarScrollGlow) return 0;
    const y = scrollY.value;
    if (y <= AVATAR_GLOW_SCROLL_PEAK) {
      return -y * ACTIONS_PARALLAX_SLOW;
    }
    return (
      -AVATAR_GLOW_SCROLL_PEAK * ACTIONS_PARALLAX_SLOW -
      (y - AVATAR_GLOW_SCROLL_PEAK) * ACTIONS_PARALLAX_FAST
    );
  });

  const avatarWrapStyle = useAnimatedStyle(() => {
    const p = collapseP.value;
    const lift = Math.sin(p * Math.PI * 0.5);
    return {
      opacity: interpolate(p, [0, 0.75, 1], [1, 0.4, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: -avatarLiftY * lift + avatarParallaxY.value },
        { scale: interpolate(p, [0, 1], [1, 0.42]) },
      ],
    };
  });

  const avatarGlowStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return {};
    const y = scrollY.value;
    const peak = AVATAR_GLOW_HEADER_PEAK_SCROLL;
    if (y <= peak) {
      return {
        borderColor: interpolateColor(y, [0, peak], [
          AVATAR_BORDER_SAGE,
          AVATAR_BORDER_SAGE_PEAK,
        ]),
      };
    }
    return {
      borderColor: interpolateColor(y, [peak, PROFILE_COLLAPSE_DISTANCE], [
        AVATAR_BORDER_SAGE_PEAK,
        AVATAR_BORDER_SAGE,
      ]),
    };
  });

  const avatarGlowFillStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const p = collapseP.value;
    return {
      opacity: avatarGlowIntensity(y) * avatarGlowTailFade(p) * AVATAR_GLOW_FILL_MAX,
    };
  });

  const avatarGlowRingStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const p = collapseP.value;
    const glowOpacity = interpolate(
      y,
      AVATAR_GLOW_RING_RAMP,
      AVATAR_GLOW_RING_OPACITY_RAMP,
      Extrapolation.CLAMP,
    );
    const glowScale = interpolate(
      y,
      AVATAR_GLOW_RING_RAMP,
      AVATAR_GLOW_RING_SCALE_RAMP,
      Extrapolation.CLAMP,
    );
    return {
      opacity: glowOpacity * avatarGlowTailFade(p),
      transform: [{ scale: glowScale }],
    };
  });

  const avatarGlowRingSoftStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const p = collapseP.value;
    const glowOpacity = interpolate(
      y,
      AVATAR_GLOW_RING_RAMP,
      AVATAR_GLOW_RING_OPACITY_RAMP,
      Extrapolation.CLAMP,
    );
    const glowScale = interpolate(
      y,
      AVATAR_GLOW_RING_RAMP,
      AVATAR_GLOW_RING_SCALE_RAMP,
      Extrapolation.CLAMP,
    );
    return {
      opacity: glowOpacity * 0.3 * avatarGlowTailFade(p),
      transform: [{ scale: glowScale }],
    };
  });

  return {
    avatarParallaxY,
    actionsParallaxY,
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowFillStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
  };
}
