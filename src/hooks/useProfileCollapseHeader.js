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
/** Зазор от низа шапки до верха ряда кнопок (профиль контакта) */
const HEADER_TO_ACTIONS_TOP_GAP = 16;
const SCROLL_CONTENT_LIFT = 36;
/** Зазор медиа под шапкой в свёрнутом состоянии */
const SCROLL_CONTENT_GAP_BELOW_HEADER = 16;
/** Профиль контакта: зазор между статусом сети и началом скролла (до sectionSpacer) */
const CONTACT_PROFILE_MEDIA_GAP_BELOW_STATUS = 12;
const ACTION_ROW_HEIGHT = 52;
export const PROFILE_COLLAPSE_DISTANCE = 132;
/** Пик золотого свечения аватара (px скролла); затем fade до PROFILE_COLLAPSE_DISTANCE */
const AVATAR_GLOW_SCROLL_PEAK = 80;
const AVATAR_BORDER_SAGE = 'rgba(90,158,154,0.6)';
const AVATAR_BORDER_SAGE_PEAK = 'rgba(90,158,154,0.9)';
const AVATAR_GLOW_RING_RAMP = [0, AVATAR_GLOW_SCROLL_PEAK, PROFILE_COLLAPSE_DISTANCE];
const NAME_LINE_HEIGHT = 22;
/** Дуга имени (профиль контакта), px скролла */
const NAME_ARC_SCROLL_END = 70;
const NAME_FADE_SCROLL_START = 50;
const NAME_HIDDEN_SCROLL_START = 70;
const NAME_HEADER_SCROLL_START = 95;
const NAME_HEADER_SCROLL_END = 120;
/** Fade-in имени в шапке на 10ms позже (≈ scroll-lag при ~100ms прохода зоны) */
const NAME_HEADER_OPACITY_DELAY_MS = 10;
const NAME_HEADER_OPACITY_SCROLL_LAG =
  (NAME_HEADER_OPACITY_DELAY_MS / 100) *
  (NAME_HEADER_SCROLL_END - NAME_HEADER_SCROLL_START);
const NAME_ARC_RADIUS = 60;
/** Якорь имени под аватаром → смещение от центра орбиты (низ круга = старт) */
const NAME_ORBIT_BELOW_CENTER = PROFILE_AVATAR_SIZE / 2 + NAME_MARGIN_TOP;
export const HEADER_MINI_AVATAR_SIZE = CHAT_HEADER_AVATAR_SIZE;
const HEADER_MINI_AVATAR_GAP = 8;
const HEADER_BACK_SLOT_W = 40;
/** Как ChatRoomHeader: back marginLeft −10, marginRight 1; avatar marginLeft 8 */
const CHAT_HEADER_BACK_MARGIN_LEFT = -10;
const CHAT_HEADER_BACK_MARGIN_RIGHT = 1;
const CHAT_HEADER_AVATAR_MARGIN_LEFT = 8;
/** Позиция статуса в шапке — как ChatRoomHeader (не трогает layout нижнего статуса) */
const CHAT_HEADER_NAME_LINE_HEIGHT = 20;
const CHAT_HEADER_STATUS_GAP = (2 * 2) / 3;
const HEADER_UNDER_GLOW_HEIGHT = 32;
/** Сдвиг вверх: яркий край градиента под непрозрачной шапкой */
export const HEADER_UNDER_GLOW_LIFT_UP = 20;
const PROFILE_CHROME_Z_BELOW_FLOAT = 8;
/** Имя поверх шапки на всей дуге collapse */
const NAME_ABOVE_HEADER_Z = 12;
const STATUS_MARGIN_TOP = 6;
const STATUS_LINE_HEIGHT = 13;
/** Пороги snap: верх мягче (легче раскрыть), низ туже (раньше фиксирует collapse) */
const SNAP_EXPAND_THRESHOLD = 0.38;
const SNAP_COLLAPSE_THRESHOLD = 0.34;
const COLLAPSE_SNAP_ZONE_EXTRA = 12;
/** Раскрытие (y→0): мягкая пружина */
const SNAP_SPRING_EXPAND = { damping: 30, stiffness: 165, mass: 1 };
/** Сворачивание (y→collapse): тугая, короткая */
const SNAP_SPRING_COLLAPSE = { damping: 24, stiffness: 440, mass: 0.72 };
const SNAP_DRAG_MIN_PX = 8;

/** Fade свечения вместе с появлением имени в шапке (профиль контакта). */
function glowHeaderNameFade(y) {
  'worklet';
  return interpolate(
    y,
    [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
    [1, 0],
    Extrapolation.CLAMP,
  );
}

function snapHeaderSpring(offsetY, scrollRef, scrollY, snapDriving) {
  'worklet';
  cancelAnimation(scrollY);
  snapDriving.value = true;
  const spring = offsetY <= 0 ? SNAP_SPRING_EXPAND : SNAP_SPRING_COLLAPSE;
  scrollY.value = withSpring(offsetY, spring, (finished) => {
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
    const committed = y <= PROFILE_COLLAPSE_DISTANCE * (1 - SNAP_EXPAND_THRESHOLD);
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
  const headerNameTop = headerLayout.paddingTop;
  const nameEndY = headerNameTop;
  const nameStartY = avatarTop + PROFILE_AVATAR_SIZE + NAME_MARGIN_TOP;
  const statusStartY = nameStartY + NAME_LINE_HEIGHT + STATUS_MARGIN_TOP;
  const avatarLiftY =
    avatarTop -
    (headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - PROFILE_AVATAR_SIZE / 2);

  const headerMiniAvatarLeft =
    MESSENGER_HEADER_PADDING_HORIZONTAL +
    CHAT_HEADER_BACK_MARGIN_LEFT +
    HEADER_BACK_SLOT_W +
    CHAT_HEADER_BACK_MARGIN_RIGHT +
    CHAT_HEADER_AVATAR_MARGIN_LEFT;
  const headerMiniAvatarTop = headerNameTop;
  const headerNameLeft =
    headerMiniAvatarLeft + HEADER_MINI_AVATAR_SIZE + HEADER_MINI_AVATAR_GAP;
  const nameHeaderTx = headerNameLeft - screenW / 2;
  const nameHeaderTy = nameEndY - nameStartY;
  const headerStatusTop =
    headerNameTop + CHAT_HEADER_NAME_LINE_HEIGHT + CHAT_HEADER_STATUS_GAP;

  const statusBlock = withStatusRow ? STATUS_MARGIN_TOP + STATUS_LINE_HEIGHT : 0;
  const actionsFloatTop = withAvatarScrollGlow ? headerH + HEADER_TO_ACTIONS_TOP_GAP : 0;
  const scrollTopPadding = withAvatarScrollGlow
    ? AVATAR_MARGIN_TOP +
      avatarTopExtra +
      PROFILE_AVATAR_SIZE +
      NAME_MARGIN_TOP +
      NAME_LINE_HEIGHT +
      statusBlock +
      CONTACT_PROFILE_MEDIA_GAP_BELOW_STATUS
    : AVATAR_MARGIN_TOP +
      avatarTopExtra +
      PROFILE_AVATAR_SIZE +
      NAME_MARGIN_TOP +
      NAME_LINE_HEIGHT +
      statusBlock +
      ACTIONS_MARGIN_TOP +
      ACTION_ROW_HEIGHT -
      SCROLL_CONTENT_LIFT;

  const scrollContentPullSv = useSharedValue(
    withAvatarScrollGlow
      ? SCROLL_CONTENT_GAP_BELOW_HEADER - scrollTopPadding + PROFILE_COLLAPSE_DISTANCE
      : 0,
  );

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
    if (y >= NAME_HEADER_SCROLL_START) {
      return {
        borderColor: interpolateColor(
          y,
          [NAME_HEADER_SCROLL_START, NAME_HEADER_SCROLL_END],
          [AVATAR_BORDER_SAGE_PEAK, AVATAR_BORDER_SAGE],
        ),
      };
    }
    return {
      borderColor: interpolateColor(y, [0, AVATAR_GLOW_SCROLL_PEAK], [
        AVATAR_BORDER_SAGE,
        AVATAR_BORDER_SAGE_PEAK,
      ]),
    };
  });

  const avatarGlowRingStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const glowOpacity = interpolate(y, AVATAR_GLOW_RING_RAMP, [0, 0.7, 0], Extrapolation.CLAMP);
    const glowScale = interpolate(y, AVATAR_GLOW_RING_RAMP, [1, 1.08, 1.08], Extrapolation.CLAMP);
    return {
      opacity: glowOpacity * glowHeaderNameFade(y),
      transform: [{ scale: glowScale }],
    };
  });

  const avatarGlowRingSoftStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return { opacity: 0 };
    const y = scrollY.value;
    const glowOpacity = interpolate(y, AVATAR_GLOW_RING_RAMP, [0, 0.7, 0], Extrapolation.CLAMP);
    const glowScale = interpolate(y, AVATAR_GLOW_RING_RAMP, [1, 1.08, 1.08], Extrapolation.CLAMP);
    return {
      opacity: glowOpacity * 0.3 * glowHeaderNameFade(y),
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

  const nameHeaderChromeStackStyle = useAnimatedStyle(() => {
    if (!withAvatarScrollGlow) return {};
    return { zIndex: NAME_ABOVE_HEADER_Z };
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
    const lift = Math.sin(p * Math.PI * 0.5);
    const y = scrollY.value;
    let parallaxY = 0;
    if (y <= AVATAR_GLOW_SCROLL_PEAK) {
      parallaxY = -y * 0.5;
    } else {
      parallaxY = -AVATAR_GLOW_SCROLL_PEAK * 0.5 - (y - AVATAR_GLOW_SCROLL_PEAK) * 1.5;
    }
    return {
      opacity: interpolate(p, [0, 0.55, 1], [1, 0.25, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: -avatarLiftY * lift + parallaxY },
        { scale: interpolate(p, [0, 1], [1, 0.38]) },
      ],
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
    scrollContentPullStyle,
    scrollSnapHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    avatarTop,
    actionsFloatTop,
    actionsFloatStyle,
    nameStartY,
    statusStartY,
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
    nameStyle,
    statusStyle,
    headerStatusStyle,
    nameWidthSv,
    onNameLayout,
    headerNameLeft,
    headerStatusTop,
    headerHeight: headerH,
    headerUnderGlowTop: headerH - HEADER_UNDER_GLOW_LIFT_UP,
    headerUnderGlowHeight: HEADER_UNDER_GLOW_HEIGHT + HEADER_UNDER_GLOW_LIFT_UP,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
    nameHeaderChromeStackStyle,
  };
}
