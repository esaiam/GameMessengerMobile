import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { useMessengerHeaderLayout } from '../../components/MessengerHeaderLayout';
import {
  PROFILE_COLLAPSE_DISTANCE,
  useProfileCollapseHeader,
} from '../../hooks/useProfileCollapseHeader';
import { safeGoBackFromContactProfile } from '../../lib/safeGoBack';
import { useContactProfileSwipeBack } from '../../hooks/useContactProfileSwipeBack';
import { useContactProfileRoomMedia } from '../../hooks/useContactProfileRoomMedia';
import { useContactProfileIdentity } from '../../hooks/contactProfile/useContactProfileIdentity';
import { useContactProfileActions } from '../../hooks/contactProfile/useContactProfileActions';
import { useContactProfileMediaSelection } from '../../hooks/contactProfile/useContactProfileMediaSelection';
import { useContactProfileMediaViewer } from '../../hooks/contactProfile/useContactProfileMediaViewer';
import { useContactProfileHardwareBack } from '../../hooks/contactProfile/useContactProfileHardwareBack';
import { useIsSplitLayout } from '../../hooks/useIsSplitLayout';

/** Зазор под шапкой до аватара (~80–100px; в хуке AVATAR_MARGIN_TOP = −12) */
const CONTACT_PROFILE_AVATAR_BELOW_HEADER = 96;

export function useContactProfileController({ route, navigation }) {
  const { peerName, contactOnline, roomId, nickname } = route.params || {};
  const insets = useSafeAreaInsets();
  const headerLayout = useMessengerHeaderLayout();
  const isTablet = useIsSplitLayout();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [profilePaneWidth, setProfilePaneWidth] = useState(screenW);
  const profileLayoutW = isTablet ? profilePaneWidth : screenW;

  useEffect(() => {
    if (!isTablet) {
      setProfilePaneWidth(screenW);
    }
  }, [isTablet, screenW]);

  const { items: mediaItems, loading: mediaLoading, reload: reloadMedia } =
    useContactProfileRoomMedia(roomId, nickname);

  const {
    blocked,
    setBlocked,
    localDisplayName,
    setLocalDisplayName,
    displayName,
    peerAvatarUri,
  } = useContactProfileIdentity({ nickname, peerName });

  const {
    busy,
    setBusy,
    handleDeleteContact,
    handleShareContact,
    handleSaveContactAlias,
    handleBlock,
  } = useContactProfileActions({
    nickname,
    peerName,
    roomId,
    navigation,
    blocked,
    setBlocked,
    setLocalDisplayName,
  });

  const dismissViewerRef = useRef(null);

  const {
    mediaSelectionMode,
    selectedMediaIds,
    exitMediaSelection,
    toggleMediaSelection,
    handleMediaLongPress,
    handleDeleteSelectedMedia,
  } = useContactProfileMediaSelection({
    nickname,
    roomId,
    setBusy,
    reloadMedia,
    onDismissViewer: () => dismissViewerRef.current?.(),
  });

  const {
    mediaViewerRef,
    viewerVisible,
    viewerIndex,
    viewerOriginLayout,
    viewerOpenEpoch,
    viewerItems,
    hiddenTileId,
    handleTileLayout,
    handleRegisterTransitionSource,
    getTransitionSource,
    remeasureTransitionSource,
    getCloseTransitionSource,
    handleMediaPress,
    handoffMediaViewerTile,
    dismissMediaViewer,
    dismissViewerForSelection,
    handleViewerIndexChange,
    wrapProfileScrollEnd,
  } = useContactProfileMediaViewer({
    mediaItems,
    mediaSelectionMode,
    toggleMediaSelection,
  });

  dismissViewerRef.current = dismissViewerForSelection;

  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [editContactVisible, setEditContactVisible] = useState(false);

  useContactProfileHardwareBack({
    navigation,
    viewerVisible,
    mediaViewerRef,
    mediaSelectionMode,
    exitMediaSelection,
  });

  const collapseHeader = useProfileCollapseHeader({
    headerLayout,
    screenW: profileLayoutW,
    withStatusRow: true,
    withAvatarScrollGlow: true,
    avatarTopExtra: CONTACT_PROFILE_AVATAR_BELOW_HEADER,
  });

  const handleProfilePaneLayout = useCallback((e) => {
    if (!isTablet) return;
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setProfilePaneWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    }
  }, [isTablet]);

  const goBackToChat = useCallback(() => {
    safeGoBackFromContactProfile(navigation);
  }, [navigation]);

  const swipeBackGesture = useContactProfileSwipeBack(goBackToChat);

  const goToContactsTab = useCallback(() => {
    navigation.getParent()?.navigate('Contacts', { screen: 'ContactsHome' });
  }, [navigation]);

  const handleEditContact = useCallback(() => {
    setEditContactVisible(true);
  }, []);

  const minScrollContentHeight =
    screenH - headerLayout.minHeight + PROFILE_COLLAPSE_DISTANCE + 32;

  return {
    swipeBackGesture,
    peerName,
    contactOnline,
    roomId,
    insets,
    headerLayout,
    profileLayoutW,
    handleProfilePaneLayout,
    mediaItems,
    mediaLoading,
    blocked,
    localDisplayName,
    displayName,
    peerAvatarUri,
    busy,
    mediaSelectionMode,
    selectedMediaIds,
    exitMediaSelection,
    handleDeleteSelectedMedia,
    overflowMenuVisible,
    setOverflowMenuVisible,
    editContactVisible,
    setEditContactVisible,
    handleDeleteContact,
    handleShareContact,
    handleSaveContactAlias,
    handleBlock,
    handleEditContact,
    goBackToChat,
    goToContactsTab,
    minScrollContentHeight,
    collapseHeader,
    mediaViewerRef,
    viewerVisible,
    viewerIndex,
    viewerOriginLayout,
    viewerOpenEpoch,
    viewerItems,
    hiddenTileId,
    handleTileLayout,
    handleRegisterTransitionSource,
    getTransitionSource,
    remeasureTransitionSource,
    getCloseTransitionSource,
    handleMediaPress,
    handoffMediaViewerTile,
    dismissMediaViewer,
    handleViewerIndexChange,
    wrapProfileScrollEnd,
    handleMediaLongPress,
  };
}
