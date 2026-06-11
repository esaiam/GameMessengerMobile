import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  ACTIONS_LIFT_SPEED,
  NAME_HEADER_OPACITY_SCROLL_LAG,
  NAME_HEADER_SCROLL_END,
  NAME_HEADER_SCROLL_START,
  PROFILE_CHROME_Z_BELOW_FLOAT,
} from './profileCollapseConstants';
import { glowHeaderNameFade } from './profileCollapseWorklets';

/**
 * Status, action buttons, under-glow, scroll content pull.
 * @param {{ scrollY: import('react-native-reanimated').SharedValue<number>, collapseP: import('react-native-reanimated').DerivedValue<number>, withAvatarScrollGlow: boolean, scrollContentPullSv: import('react-native-reanimated').SharedValue<number>, avatarLiftY: number, actionsParallaxY: import('react-native-reanimated').DerivedValue<number> }} options
 */
export function useProfileCollapseChromeStyles({
  scrollY,
  collapseP,
  withAvatarScrollGlow,
  scrollContentPullSv,
  avatarLiftY,
  actionsParallaxY,
}) {
  const headerUnderGlowStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    return {
      opacity:
        interpolate(y, [40, 80], [0, 1], Extrapolation.CLAMP) * glowHeaderNameFade(y),
    };
  });

  const profileChromeStackStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { zIndex: PROFILE_CHROME_Z_BELOW_FLOAT };
    return {};
  });

  const statusStyle = useAnimatedStyle(() => {
    const p = collapseP.value;
    return {
      opacity: interpolate(p, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
    };
  });

  const headerStatusStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    return {
      opacity: interpolate(
        y,
        [
          NAME_HEADER_SCROLL_START + NAME_HEADER_OPACITY_SCROLL_LAG,
          NAME_HEADER_SCROLL_END,
        ],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const scrollContentPullStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return {};
    const pullAtCollapse = scrollContentPullSv.value;
    if (pullAtCollapse >= 0) return {};
    const y = scrollY.value;
    if (y < NAME_HEADER_SCROLL_START) return {};
    const pullT =
      y >= NAME_HEADER_SCROLL_END
        ? 1
        : interpolate(
            y,
            [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
            [0, 1],
            Extrapolation.CLAMP,
          );
    return { transform: [{ translateY: pullAtCollapse * pullT }] };
  });

  const actionsFloatStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return {};
    const p = collapseP.value;
    const liftP = Math.min(p * ACTIONS_LIFT_SPEED, 1);
    const lift = Math.sin(liftP * Math.PI * 0.5);
    return {
      opacity: interpolate(p, [0, 0.2, 0.45], [1, 0.15, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: -avatarLiftY * lift + actionsParallaxY.value },
        { scale: interpolate(p, [0, 0.5, 0.72], [1, 0.38, 0.28], Extrapolation.CLAMP) },
      ],
    };
  });

  return {
    headerUnderGlowStyle,
    profileChromeStackStyle,
    statusStyle,
    headerStatusStyle,
    scrollContentPullStyle,
    actionsFloatStyle,
  };
}
