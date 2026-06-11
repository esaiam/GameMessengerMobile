import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBackground from '../components/TabBackground';
import {
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';
import {
  PROFILE_COLLAPSE_DISTANCE,
  useProfileCollapseHeader,
} from '../hooks/useProfileCollapseHeader';
import { safeGoBackFromContactProfile } from '../lib/safeGoBack';
import { useContactProfileSwipeBack } from '../hooks/useContactProfileSwipeBack';
import { useContactProfileRoomMedia } from '../hooks/useContactProfileRoomMedia';
import { useContactProfileIdentity } from '../hooks/contactProfile/useContactProfileIdentity';
import { useContactProfileActions } from '../hooks/contactProfile/useContactProfileActions';
import { useContactProfileMediaSelection } from '../hooks/contactProfile/useContactProfileMediaSelection';
import { useContactProfileMediaViewer } from '../hooks/contactProfile/useContactProfileMediaViewer';
import { useContactProfileHardwareBack } from '../hooks/contactProfile/useContactProfileHardwareBack';
import ContactProfileHeaderBar from '../components/contactProfile/ContactProfileHeaderBar';
import ContactProfileFloatingChrome from '../components/contactProfile/ContactProfileFloatingChrome';
import ContactProfileScrollBody from '../components/contactProfile/ContactProfileScrollBody';
import ContactProfileMediaViewerModal from '../components/contactProfile/ContactProfileMediaViewerModal';
import ContactProfileOverflowMenuModal from '../components/contactProfile/ContactProfileOverflowMenuModal';
import ContactProfileEditContactModal from '../components/contactProfile/ContactProfileEditContactModal';
import { styles } from './contactProfile/contactProfileScreenStyles';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import { CHATS_HEADER_GLOW_STOP_CENTER } from '../components/chats/ChatsHeaderGlow';

/** Зазор под шапкой до аватара (~80–100px; в хуке AVATAR_MARGIN_TOP = −12) */
const CONTACT_PROFILE_AVATAR_BELOW_HEADER = 96;

export default function ContactProfileScreen({ route, navigation }) {
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

  const {
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
    onNameLayout,
    headerNameLeft,
    headerStatusTop,
    headerHeight,
    headerUnderGlowTop,
    headerUnderGlowHeight,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
    nameHeaderChromeStackStyle,
  } = useProfileCollapseHeader({
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

  const goToContactsTab = () => {
    navigation.getParent()?.navigate('Contacts', { screen: 'ContactsHome' });
  };

  const handleEditContact = useCallback(() => {
    setEditContactVisible(true);
  }, []);

  const minScrollContentHeight =
    screenH - headerLayout.minHeight + PROFILE_COLLAPSE_DISTANCE + 32;

  const content = (
    <TabBackground>
      <Animated.View
        style={[styles.flexRoot, profileChromeStackStyle]}
        onLayout={handleProfilePaneLayout}
      >
        <ContactProfileHeaderBar
          headerLayout={headerLayout}
          mediaSelectionMode={mediaSelectionMode}
          selectedCount={selectedMediaIds.size}
          busy={busy}
          onBack={goBackToChat}
          onOpenMenu={() => setOverflowMenuVisible(true)}
          onExitSelection={exitMediaSelection}
          onDeleteSelected={handleDeleteSelectedMedia}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerUnderGlow,
            { top: headerUnderGlowTop, height: headerUnderGlowHeight },
            headerUnderGlowStyle,
          ]}
        >
          <LinearGradient
            colors={[`rgba(90,158,154,${CHATS_HEADER_GLOW_STOP_CENTER})`, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.headerUnderGlowGradient}
          />
        </Animated.View>

        <ContactProfileScrollBody
          scrollRef={scrollRef}
          scrollTopPadding={scrollTopPadding}
          scrollContentPullStyle={scrollContentPullStyle}
          scrollSnapHandler={scrollSnapHandler}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          wrapProfileScrollEnd={wrapProfileScrollEnd}
          bottomInset={insets.bottom}
          minScrollContentHeight={minScrollContentHeight}
          mediaItems={mediaItems}
          mediaLoading={mediaLoading}
          roomId={roomId}
          selectionMode={mediaSelectionMode}
          selectedIds={selectedMediaIds}
          hiddenTileId={hiddenTileId}
          onMediaPress={handleMediaPress}
          onMediaLongPress={handleMediaLongPress}
          onTileLayout={handleTileLayout}
          onRegisterTransitionSource={handleRegisterTransitionSource}
        />

        <ContactProfileFloatingChrome
          profileLayoutW={profileLayoutW}
          contactOnline={contactOnline}
          displayName={displayName}
          peerAvatarUri={peerAvatarUri}
          busy={busy}
          blocked={blocked}
          onMessage={goBackToChat}
          onContacts={goToContactsTab}
          actionsFloatTop={actionsFloatTop}
          actionsFloatStyle={actionsFloatStyle}
          statusStartY={statusStartY}
          statusStyle={statusStyle}
          avatarTop={avatarTop}
          avatarWrapStyle={avatarWrapStyle}
          avatarGlowStyle={avatarGlowStyle}
          avatarGlowFillStyle={avatarGlowFillStyle}
          avatarGlowRingStyle={avatarGlowRingStyle}
          avatarGlowRingSoftStyle={avatarGlowRingSoftStyle}
          nameStartY={nameStartY}
          nameStyle={nameStyle}
          headerStatusStyle={headerStatusStyle}
          onNameLayout={onNameLayout}
          headerNameLeft={headerNameLeft}
          headerStatusTop={headerStatusTop}
          headerMiniAvatarLeft={headerMiniAvatarLeft}
          headerMiniAvatarTop={headerMiniAvatarTop}
          headerMiniAvatarStyle={headerMiniAvatarStyle}
          nameHeaderChromeStackStyle={nameHeaderChromeStackStyle}
        />
      </Animated.View>

      <ContactProfileOverflowMenuModal
        visible={overflowMenuVisible}
        onClose={() => setOverflowMenuVisible(false)}
        blocked={blocked}
        onShare={handleShareContact}
        onBlock={handleBlock}
        onEdit={handleEditContact}
        onDeleteContact={handleDeleteContact}
        deleteDisabled={busy || !roomId}
      />
      <ContactProfileEditContactModal
        visible={editContactVisible}
        initialName={localDisplayName || peerName || ''}
        onClose={() => setEditContactVisible(false)}
        onSave={handleSaveContactAlias}
      />
      <ContactProfileMediaViewerModal
        ref={mediaViewerRef}
        visible={viewerVisible}
        items={viewerItems}
        viewIndex={viewerIndex}
        initialTransitionSource={viewerOriginLayout}
        getTransitionSource={getTransitionSource}
        remeasureTransitionSource={remeasureTransitionSource}
        getCloseTransitionSource={getCloseTransitionSource}
        openEpoch={viewerOpenEpoch}
        onHandoff={handoffMediaViewerTile}
        onClose={dismissMediaViewer}
        onIndexChange={handleViewerIndexChange}
      />
    </TabBackground>
  );

  return swipeBackGesture ? (
    <GestureDetector gesture={swipeBackGesture}>
      <View style={styles.flex} collapsable={false}>
        {content}
      </View>
    </GestureDetector>
  ) : (
    content
  );
}
