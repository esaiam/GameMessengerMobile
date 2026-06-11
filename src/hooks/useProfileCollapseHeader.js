import { useProfileCollapseAvatarStyles } from './profileCollapse/useProfileCollapseAvatarStyles';
import { useProfileCollapseChromeStyles } from './profileCollapse/useProfileCollapseChromeStyles';
import { useProfileCollapseNameStyles } from './profileCollapse/useProfileCollapseNameStyles';
import { useProfileCollapseScrollMetrics } from './profileCollapse/useProfileCollapseScrollMetrics';
import { useProfileCollapseSnap } from './profileCollapse/useProfileCollapseSnap';

export {
  HEADER_MINI_AVATAR_SIZE,
  HEADER_UNDER_GLOW_LIFT_UP,
  PROFILE_AVATAR_SIZE,
  PROFILE_COLLAPSE_DISTANCE,
} from './profileCollapse/profileCollapseConstants';

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
  const {
    scrollRef,
    scrollY,
    collapseP,
    scrollSnapHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  } = useProfileCollapseSnap();

  const {
    headerH,
    avatarTop,
    nameStartY,
    statusStartY,
    avatarLiftY,
    nameEndY,
    nameHeaderTx,
    nameHeaderTy,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerNameLeft,
    headerStatusTop,
    actionsFloatTop,
    scrollTopPadding,
    scrollContentPullSv,
    headerUnderGlowTop,
    headerUnderGlowHeight,
  } = useProfileCollapseScrollMetrics({
    headerLayout,
    screenW,
    withStatusRow,
    withAvatarScrollGlow,
    avatarTopExtra,
  });

  const {
    avatarParallaxY,
    actionsParallaxY,
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowFillStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
  } = useProfileCollapseAvatarStyles({
    scrollY,
    collapseP,
    withAvatarScrollGlow,
    avatarLiftY,
  });

  const {
    nameWidthSv,
    onNameLayout,
    nameStyle,
    headerMiniAvatarStyle,
    nameHeaderChromeStackStyle,
  } = useProfileCollapseNameStyles({
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
  });

  const {
    headerUnderGlowStyle,
    profileChromeStackStyle,
    statusStyle,
    headerStatusStyle,
    scrollContentPullStyle,
    actionsFloatStyle,
  } = useProfileCollapseChromeStyles({
    scrollY,
    collapseP,
    withAvatarScrollGlow,
    scrollContentPullSv,
    avatarLiftY,
    actionsParallaxY,
  });

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
    avatarGlowFillStyle,
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
    headerUnderGlowTop,
    headerUnderGlowHeight,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
    nameHeaderChromeStackStyle,
  };
}
