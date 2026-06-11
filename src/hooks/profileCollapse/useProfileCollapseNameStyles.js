import { useCallback } from 'react';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../../components/MessengerHeaderLayout';
import {
  HEADER_MINI_AVATAR_SIZE,
  NAME_ABOVE_HEADER_Z,
  NAME_ARC_RADIUS,
  NAME_ARC_SCROLL_END,
  NAME_FADE_SCROLL_START,
  NAME_HEADER_OPACITY_SCROLL_LAG,
  NAME_HEADER_SCROLL_END,
  NAME_HEADER_SCROLL_START,
  NAME_HIDDEN_SCROLL_START,
  NAME_ORBIT_BELOW_CENTER,
  PROFILE_COLLAPSE_DISTANCE,
} from './profileCollapseConstants';

/**
 * Имя: орбита, blend в шапку, mini avatar, z-index chrome.
 * @param {{ scrollY: import('react-native-reanimated').SharedValue<number>, collapseP: import('react-native-reanimated').DerivedValue<number>, withAvatarScrollGlow: boolean, avatarParallaxY: import('react-native-reanimated').DerivedValue<number>, avatarLiftY: number, nameHeaderTx: number, nameHeaderTy: number, nameEndY: number, nameStartY: number, screenW: number }} options
 */
export function useProfileCollapseNameStyles({
  scrollY,
  collapseP,
  withAvatarScrollGlow,
  avatarParallaxY,
  avatarLiftY,
  nameHeaderTx,
  nameHeaderTy,
  nameEndY,
  nameStartY,
  screenW,
}) {
  const nameWidthSv = useSharedValue(120);

  const nameStyle = useAnimatedStyle(() => {
    if (withAvatarScrollGlow) {
      const y = scrollY.value;
      const half = nameWidthSv.value / 2;
      const p = Math.min(Math.max(y / PROFILE_COLLAPSE_DISTANCE, 0), 1);
      const lift = Math.sin(p * Math.PI * 0.5);
      /** Тот же подъём, что у аватара (parallax + collapse lift) */
      const nameFollowY = avatarParallaxY.value - avatarLiftY * lift;

      /**
       * Орбита вокруг центра аватара: θ π/2→−π (низ → право → верх → лево), без изломов keyframe.
       * Угол тянется до появления в шапке, чтобы не было скачка влево на ~42% скролла.
       */
      const orbitAngle = interpolate(
        y,
        [0, NAME_HEADER_SCROLL_START],
        [Math.PI / 2, -Math.PI],
        Extrapolation.CLAMP,
      );
      const orbitX = Math.cos(orbitAngle) * NAME_ARC_RADIUS;
      const orbitY = Math.sin(orbitAngle) * NAME_ARC_RADIUS - NAME_ORBIT_BELOW_CENTER;

      if (y >= NAME_HEADER_SCROLL_START) {
        const headerBlend = interpolate(
          y,
          [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
          [0, 1],
          Extrapolation.CLAMP,
        );
        const headerOpacity = interpolate(
          y,
          [
            NAME_HEADER_SCROLL_START + NAME_HEADER_OPACITY_SCROLL_LAG,
            NAME_HEADER_SCROLL_END,
          ],
          [0, 1],
          Extrapolation.CLAMP,
        );
        return {
          opacity: headerOpacity,
          transform: [
            {
              translateX: -half + orbitX + (nameHeaderTx + half - orbitX) * headerBlend,
            },
            {
              translateY:
                orbitY + nameFollowY + (nameHeaderTy - orbitY - nameFollowY) * headerBlend,
            },
          ],
        };
      }

      const opacity =
        y > NAME_HIDDEN_SCROLL_START
          ? 0
          : interpolate(
              y,
              [NAME_FADE_SCROLL_START, NAME_ARC_SCROLL_END],
              [1, 0],
              Extrapolation.CLAMP,
            );

      return {
        opacity,
        transform: [
          { translateX: -half + orbitX },
          { translateY: orbitY + nameFollowY },
        ],
      };
    }

    const p = collapseP.value;
    const arcY = Math.sin(p * Math.PI * 0.5);
    const arcX = 1 - Math.cos(p * Math.PI * 0.5);
    const half = nameWidthSv.value / 2;
    const startTx = -half;
    const endTx = MESSENGER_HEADER_PADDING_HORIZONTAL - screenW / 2;
    return {
      transform: [
        { translateX: startTx + (endTx - startTx) * arcX },
        { translateY: (nameEndY - nameStartY) * arcY },
      ],
    };
  });

  const headerMiniAvatarStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0, width: 0, height: 0 };
    const y = scrollY.value;
    const size = interpolate(
      y,
      [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
      [0, HEADER_MINI_AVATAR_SIZE],
      Extrapolation.CLAMP,
    );
    return {
      opacity: interpolate(
        y,
        [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      width: size,
      height: size,
      borderRadius: size / 2,
    };
  });

  const nameHeaderChromeStackStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return {};
    return { zIndex: NAME_ABOVE_HEADER_Z };
  });

  const onNameLayout = useCallback(
    (e) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) nameWidthSv.value = w;
    },
    [nameWidthSv],
  );

  return {
    nameWidthSv,
    onNameLayout,
    nameStyle,
    headerMiniAvatarStyle,
    nameHeaderChromeStackStyle,
  };
}
