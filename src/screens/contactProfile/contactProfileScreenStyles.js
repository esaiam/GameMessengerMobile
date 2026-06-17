import { StyleSheet, Platform } from 'react-native';
import { V } from '../../theme';
import {
  MESSENGER_HEADER_CONTENT_MIN_HEIGHT,
} from '../../components/MessengerHeaderLayout';
import {
  CHAT_HEADER_FROST_TINT_OPACITY,
  ICON_SELECTION_ACTION,
} from '../../components/ChatRoomHeader';
import { PROFILE_AVATAR_SIZE } from '../../hooks/useProfileCollapseHeader';

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  flexRoot: {
    flex: 1,
    position: 'relative',
  },
  headerBar: {
    overflow: 'hidden',
    zIndex: 8,
  },
  headerBarFrostTint: {
    backgroundColor: V.bgChatsScreen,
    opacity: CHAT_HEADER_FROST_TINT_OPACITY,
  },
  headerUnderGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  headerUnderGlowGradient: {
    flex: 1,
  },
  headerMiniAvatar: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackTouch: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    marginRight: 1,
  },
  headerIconWrap: {
    width: ICON_SELECTION_ACTION + 8,
    height: ICON_SELECTION_ACTION + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMenuSlot: {
    width: ICON_SELECTION_ACTION,
    height: MESSENGER_HEADER_CONTENT_MIN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMenuTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSelectionDeleteTouch: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: ICON_SELECTION_ACTION + 12,
  },
  headerSelectionCount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  headerActionDisabled: {
    opacity: 0.35,
  },
  scrollContent: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  floatingLayerUnder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  actionsFloat: {
    position: 'absolute',
  },
  nameHeaderChrome: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarFloat: {
    position: 'absolute',
    zIndex: 4,
  },
  avatarCluster: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    position: 'relative',
    overflow: 'visible',
  },
  avatarGlowOutlineInner: {
    position: 'absolute',
    width: PROFILE_AVATAR_SIZE + 16,
    height: PROFILE_AVATAR_SIZE + 16,
    borderRadius: (PROFILE_AVATAR_SIZE + 16) / 2,
    top: -8,
    left: -8,
  },
  avatarGlowOutlineOuter: {
    position: 'absolute',
    width: PROFILE_AVATAR_SIZE + 28,
    height: PROFILE_AVATAR_SIZE + 28,
    borderRadius: (PROFILE_AVATAR_SIZE + 28) / 2,
    top: -14,
    left: -14,
  },
  avatarGlowRing: {
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  avatarGlowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    backgroundColor: V.accentSage,
  },
  nameFloat: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: '92%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  headerStatusFloat: {
    position: 'absolute',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  statusFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  sectionSpacer: {
    height: 28,
  },
  actionBtn: {
    flex: 1,
    maxWidth: 132,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  disabled: {
    opacity: 0.45,
  },
});
