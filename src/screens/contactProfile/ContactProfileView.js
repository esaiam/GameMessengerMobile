import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector } from 'react-native-gesture-handler';
import TabBackground from '../../components/TabBackground';
import ContactProfileHeaderBar from '../../components/contactProfile/ContactProfileHeaderBar';
import ContactProfileFloatingChrome from '../../components/contactProfile/ContactProfileFloatingChrome';
import ContactProfileScrollBody from '../../components/contactProfile/ContactProfileScrollBody';
import ContactProfileMediaViewerModal from '../../components/contactProfile/ContactProfileMediaViewerModal';
import ContactProfileOverflowMenuModal from '../../components/contactProfile/ContactProfileOverflowMenuModal';
import ContactProfileEditContactModal from '../../components/contactProfile/ContactProfileEditContactModal';
import { CHATS_HEADER_GLOW_STOP_CENTER } from '../../components/chats/ChatsHeaderGlow';
import { styles } from './contactProfileScreenStyles';

export default function ContactProfileView({
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
}) {
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
    headerUnderGlowTop,
    headerUnderGlowHeight,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
    nameHeaderChromeStackStyle,
  } = collapseHeader;

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

  if (swipeBackGesture) {
    return (
      <GestureDetector gesture={swipeBackGesture}>
        <View style={styles.flex} collapsable={false}>
          {content}
        </View>
      </GestureDetector>
    );
  }

  return content;
}
