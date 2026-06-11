import { useSharedValue } from 'react-native-reanimated';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../../components/MessengerHeaderLayout';
import {
  ACTION_ROW_HEIGHT,
  ACTIONS_MARGIN_TOP,
  AVATAR_MARGIN_TOP,
  CHAT_HEADER_AVATAR_MARGIN_LEFT,
  CHAT_HEADER_BACK_MARGIN_LEFT,
  CHAT_HEADER_BACK_MARGIN_RIGHT,
  CHAT_HEADER_NAME_LINE_HEIGHT,
  CHAT_HEADER_STATUS_GAP,
  CONTACT_PROFILE_MEDIA_GAP_BELOW_STATUS,
  HEADER_BACK_SLOT_W,
  HEADER_MINI_AVATAR_GAP,
  HEADER_MINI_AVATAR_SIZE,
  HEADER_TO_ACTIONS_TOP_GAP,
  HEADER_UNDER_GLOW_HEIGHT,
  HEADER_UNDER_GLOW_LIFT_UP,
  NAME_LINE_HEIGHT,
  NAME_MARGIN_TOP,
  PROFILE_AVATAR_SIZE,
  PROFILE_COLLAPSE_DISTANCE,
  SCROLL_CONTENT_GAP_BELOW_HEADER,
  SCROLL_CONTENT_LIFT,
  STATUS_LINE_HEIGHT,
  STATUS_MARGIN_TOP,
} from './profileCollapseConstants';

/**
 * Layout positions для collapse header: padding, chrome anchors, scroll pull baseline.
 * @param {{ headerLayout: object, screenW: number, withStatusRow?: boolean, withAvatarScrollGlow?: boolean, avatarTopExtra?: number }} options
 */
export function useProfileCollapseScrollMetrics({
  headerLayout,
  screenW,
  withStatusRow = false,
  withAvatarScrollGlow = false,
  avatarTopExtra = 0,
}) {
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

  return {
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
    headerUnderGlowTop: headerH - HEADER_UNDER_GLOW_LIFT_UP,
    headerUnderGlowHeight: HEADER_UNDER_GLOW_HEIGHT + HEADER_UNDER_GLOW_LIFT_UP,
  };
}
