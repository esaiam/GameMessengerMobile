import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  cancelAnimation,
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { CHAT_HEADER_AVATAR_SIZE } from '../components/ChatRoomHeader';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../components/MessengerHeaderLayout';
import { useMainTabsNavigationOptional } from '../context/MainTabsNavigationContext';

export const PROFILE_AVATAR_SIZE = 96;
const AVATAR_MARGIN_TOP = -12;
const NAME_MARGIN_TOP = 14;
const ACTIONS_MARGIN_TOP = 20;
const SCROLL_CONTENT_LIFT = 36;
const ACTION_ROW_HEIGHT = 52;
export const PROFILE_COLLAPSE_DISTANCE = 132;
/** Пик золотого свечения аватара (px скролла); затем fade до PROFILE_COLLAPSE_DISTANCE */
const AVATAR_GLOW_SCROLL_PEAK = 80;
const AVATAR_BORDER_SAGE = 'rgba(90,158,154,0.6)';
const AVATAR_BORDER_GOLD = 'rgba(201,168,76,0.9)';
const AVATAR_GLOW_RING_RAMP = [0, AVATAR_GLOW_SCROLL_PEAK, PROFILE_COLLAPSE_DISTANCE];
const NAME_LINE_HEIGHT = 22;
/** Дуга имени (профиль контакта), px скролла */
const NAME_ARC_SCROLL_END = 70;
const NAME_FADE_SCROLL_START = 50;
const NAME_HIDDEN_SCROLL_START = 70;
const NAME_HEADER_SCROLL_START = 95;
const NAME_HEADER_SCROLL_END = 120;
const NAME_ARC_RADIUS = 60;
/** Якорь имени под аватаром → смещение от центра орбиты (низ круга = старт) */
const NAME_ORBIT_BELOW_CENTER = PROFILE_AVATAR_SIZE / 2 + NAME_MARGIN_TOP;
export const HEADER_MINI_AVATAR_SIZE = CHAT_HEADER_AVATAR_SIZE;
const HEADER_MINI_AVATAR_GAP = 8;
const HEADER_BACK_SLOT_W = 40;
const HEADER_UNDER_GLOW_HEIGHT = 32;
/** Сдвиг вверх: яркий край градиента под непрозрачной шапкой */
export const HEADER_UNDER_GLOW_LIFT_UP = 20;
/** flexRoot выше floatingOver в дуге; ниже — имя/мини-аватар поверх шапки */
const PROFILE_CHROME_Z_ABOVE_FLOAT = 25;
const PROFILE_CHROME_Z_BELOW_FLOAT = 8;
const STATUS_MARGIN_TOP = 6;
const STATUS_LINE_HEIGHT = 13;
const SNAP_COLLAPSE_THRESHOLD = 0.42;
const COLLAPSE_SNAP_ZONE_EXTRA = 12;
const SNAP_SPRING = { damping: 22, stiffness: 280, mass: 0.85 };
const SNAP_DRAG_MIN_PX = 8;

function snapHeaderSpring(offsetY, scrollRef, scrollY, snapDriving) {
  'worklet';
  cancelAnimation(scrollY);
  snapDriving.value = true;
  scrollY.value = withSpring(offsetY, SNAP_SPRING, (finished) => {
    if (finished) {
      snapDriving.value = false;
      scrollTo(scrollRef, 0, offsetY, false);
    }
  });
}

function calcSnapTarget(y, vy, dragDelta, dragStartY) {
  if (y < 0 || y > PROFILE_COLLAPSE_DISTANCE + COLLAPSE_SNAP_ZONE_EXTRA) return -1;
  const startOffset =
    dragStartY >= PROFILE_COLLAPSE_DISTANCE * SNAP_COLLAPSE_THRESHOLD
      ? PROFILE_COLLAPSE_DISTANCE
      : 0;
  const pullExpand = dragDelta < -SNAP_DRAG_MIN_PX;
  const pullCollapse = dragDelta > SNAP_DRAG_MIN_PX;
  let offsetY;
  if (Math.abs(vy) > 0.35) {
    offsetY = vy > 0 ? 0 : PROFILE_COLLAPSE_DISTANCE;
  } else if (pullExpand) {
    const committed = y <= PROFILE_COLLAPSE_DISTANCE * (1 - SNAP_COLLAPSE_THRESHOLD);
    offsetY = committed ? 0 : startOffset;
  } else if (pullCollapse) {
    const committed = y >= PROFILE_COLLAPSE_DISTANCE * SNAP_COLLAPSE_THRESHOLD;
    offsetY = committed ? PROFILE_COLLAPSE_DISTANCE : startOffset;
  } else {
    offsetY = startOffset;
  }
  if (Math.abs(y - offsetY) < 2) return -1;
  return offsetY;
}

/**
 * Сворачивающаяся шапка профиля: аватар + имя, snap-скролл (как ProfileScreen).
 * @param {{ headerLayout: object, screenW: number, withStatusRow?: boolean, withAvatarScrollGlow?: boolean, avatarTopExtra?: number }} options
 */
export function useProfileCollapseHeader({
  headerLayout,
  screenW,
  withStatusRow = false,
  withAvatarScrollGlow = false,
  avatarTopExtra = 0,
}) {
  const scrollRef = useAnimatedRef();
  const scrollY = useSharedValue(0);
  const snapDriving = useSharedValue(false);
  const nameWidthSv = useSharedValue(120);
  const collapseP = useDerivedValue(() =>
    Math.min(Math.max(scrollY.value / PROFILE_COLLAPSE_DISTANCE, 0), 1),
  );

  /** Профиль контакта: 0→80px вполскорости, затем догоняет контент до collapse. */
  const avatarParallaxY = useDerivedValue(() => {
    if (!withAvatarScrollGlow) return 0;
    const y = scrollY.value;
    if (y <= AVATAR_GLOW_SCROLL_PEAK) {
      return -y * 0.5;
    }
    return -AVATAR_GLOW_SCROLL_PEAK * 0.5 - (y - AVATAR_GLOW_SCROLL_PEAK) * 1.5;
  });

  const scrollDragRef = useRef(false);
  const dragVyRef = useRef(0);
  const dragStartYRef = useRef(0);

  const mainTabsNav = useMainTabsNavigationOptional();
  const acquirePagerLock = mainTabsNav?.acquirePagerInteractionLock;
  const resetPagerLock = mainTabsNav?.resetPagerInteractionLock;

  const headerH = headerLayout.minHeight;
  const avatarTop = headerH + AVATAR_MARGIN_TOP + avatarTopExtra;
  const nameEndY = headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - 9;
  const nameStartY = avatarTop + PROFILE_AVATAR_SIZE + NAME_MARGIN_TOP;
  const statusStartY = nameStartY + NAME_LINE_HEIGHT + STATUS_MARGIN_TOP;
  const avatarLiftY =
    avatarTop -
    (headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - PROFILE_AVATAR_SIZE / 2);

  const headerMiniAvatarLeft = MESSENGER_HEADER_PADDING_HORIZONTAL + HEADER_BACK_SLOT_W;
  const headerMiniAvatarTop =
    headerLayout.paddingTop + (headerLayout.contentMinHeight - HEADER_MINI_AVATAR_SIZE) / 2;
  const nameHeaderTx =
    headerMiniAvatarLeft + HEADER_MINI_AVATAR_SIZE + HEADER_MINI_AVATAR_GAP - screenW / 2;
  const nameHeaderTy = nameEndY - nameStartY;

  const statusBlock = withStatusRow ? STATUS_MARGIN_TOP + STATUS_LINE_HEIGHT : 0;
  const scrollTopPadding =
    AVATAR_MARGIN_TOP +
    avatarTopExtra +
    PROFILE_AVATAR_SIZE +
    NAME_MARGIN_TOP +
    NAME_LINE_HEIGHT +
    statusBlock +
    ACTIONS_MARGIN_TOP +
    ACTION_ROW_HEIGHT -
    SCROLL_CONTENT_LIFT;

  const scrollSnapHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      if (!snapDriving.value) {
        scrollY.value = e.contentOffset.y;
      }
    },
  });

  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      if (snapDriving.value) {
        scrollTo(scrollRef, 0, y, false);
      }
    },
  );

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
    return {
      borderColor: interpolateColor(y, [0, AVATAR_GLOW_SCROLL_PEAK], [
        AVATAR_BORDER_SAGE,
        AVATAR_BORDER_GOLD,
      ]),
    };
  });

  const avatarGlowRingStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const glowOpacity = interpolate(y, AVATAR_GLOW_RING_RAMP, [0, 0.7, 0], Extrapolation.CLAMP);
    const glowScale = interpolate(y, AVATAR_GLOW_RING_RAMP, [1, 1.08, 1.08], Extrapolation.CLAMP);
    return {
      opacity: glowOpacity,
      transform: [{ scale: glowScale }],
    };
  });

  const avatarGlowRingSoftStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const glowOpacity = interpolate(y, AVATAR_GLOW_RING_RAMP, [0, 0.7, 0], Extrapolation.CLAMP);
    const glowScale = interpolate(y, AVATAR_GLOW_RING_RAMP, [1, 1.08, 1.08], Extrapolation.CLAMP);
    return {
      opacity: glowOpacity * 0.3,
      transform: [{ scale: glowScale }],
    };
  });

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
        return {
          opacity: headerBlend,
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

  const headerUnderGlowStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    return {
      opacity: interpolate(scrollY.value, [40, 80], [0, 1], Extrapolation.CLAMP),
    };
  });

  const profileChromeStackStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { zIndex: PROFILE_CHROME_Z_BELOW_FLOAT };
    return {
      zIndex:
        scrollY.value >= NAME_HEADER_SCROLL_START
          ? PROFILE_CHROME_Z_BELOW_FLOAT
          : PROFILE_CHROME_Z_ABOVE_FLOAT,
    };
  });

  const statusStyle = useAnimatedStyle(() => {
    const p = collapseP.value;
    return {
      opacity: interpolate(p, [0, 0.45, 1], [1, 0, 0], Extrapolation.CLAMP),
    };
  });

  const snapIfNeeded = useCallback(
    (y, vy, dragDelta, dragStartY) => {
      const offsetY = calcSnapTarget(y, vy, dragDelta, dragStartY);
      if (offsetY < 0) return;
      runOnUI(snapHeaderSpring)(offsetY, scrollRef, scrollY, snapDriving);
    },
    [scrollRef, scrollY, snapDriving],
  );

  const onScrollBeginDrag = useCallback(
    (e) => {
      scrollDragRef.current = true;
      dragStartYRef.current = e.nativeEvent.contentOffset.y;
      runOnUI(() => {
        'worklet';
        cancelAnimation(scrollY);
        snapDriving.value = false;
      })();
      acquirePagerLock?.();
    },
    [acquirePagerLock, scrollY, snapDriving],
  );

  const onScrollEndDrag = useCallback(
    (e) => {
      const y = e.nativeEvent.contentOffset.y;
      const vy = e.nativeEvent.velocity?.y ?? 0;
      const dragDelta = y - dragStartYRef.current;
      dragVyRef.current = vy;
      const noMomentum = Math.abs(vy) < 0.15;
      if (noMomentum) {
        scrollDragRef.current = false;
        resetPagerLock?.();
        snapIfNeeded(y, vy, dragDelta, dragStartYRef.current);
      }
    },
    [resetPagerLock, snapIfNeeded],
  );

  const onMomentumScrollEnd = useCallback(
    (e) => {
      if (scrollDragRef.current) {
        scrollDragRef.current = false;
        resetPagerLock?.();
      }
      const y = e.nativeEvent.contentOffset.y;
      const vy = dragVyRef.current;
      const dragDelta = y - dragStartYRef.current;
      dragVyRef.current = 0;
      snapIfNeeded(y, vy, dragDelta, dragStartYRef.current);
    },
    [resetPagerLock, snapIfNeeded],
  );

  useFocusEffect(
    useCallback(() => {
      runOnUI(() => {
        'worklet';
        cancelAnimation(scrollY);
        snapDriving.value = false;
        scrollY.value = 0;
        scrollTo(scrollRef, 0, 0, false);
      })();
      return () => {
        scrollDragRef.current = false;
        resetPagerLock?.();
      };
    }, [scrollRef, scrollY, snapDriving, resetPagerLock]),
  );

  const onNameLayout = useCallback(
    (e) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0) nameWidthSv.value = w;
    },
    [nameWidthSv],
  );

  return {
    scrollRef,
    scrollTopPadding,
    scrollSnapHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    avatarTop,
    nameStartY,
    statusStartY,
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
    nameStyle,
    statusStyle,
    nameWidthSv,
    onNameLayout,
    headerHeight: headerH,
    headerUnderGlowTop: headerH - HEADER_UNDER_GLOW_LIFT_UP,
    headerUnderGlowHeight: HEADER_UNDER_GLOW_HEIGHT + HEADER_UNDER_GLOW_LIFT_UP,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
  };
}
