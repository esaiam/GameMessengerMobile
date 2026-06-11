import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, EllipsisVertical, MessageCircle, User, X, Trash2 } from '../icons/lucideIcons';
import { UserAvatar } from '../components/UserAvatar';
import { GAME_NO_OVERSCROLL_PROPS, V } from '../theme';
import TabBackground from '../components/TabBackground';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';
import SafeBlurView from '../components/SafeBlurView';
import {
  CHAT_HEADER_BLUR_INTENSITY_ANDROID,
  CHAT_HEADER_BLUR_INTENSITY_IOS,
  ICON_SELECTION_ACTION,
} from '../components/ChatRoomHeader';
import {
  HEADER_MINI_AVATAR_SIZE,
  PROFILE_AVATAR_SIZE,
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
import ContactProfileMediaSection from '../components/contactProfile/ContactProfileMediaSection';
import ContactProfileMediaViewerModal from '../components/contactProfile/ContactProfileMediaViewerModal';
import ContactProfileOverflowMenuModal from '../components/contactProfile/ContactProfileOverflowMenuModal';
import ContactProfileEditContactModal from '../components/contactProfile/ContactProfileEditContactModal';
import ContactProfileActionButton from '../components/contactProfile/ContactProfileActionButton';
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
        <View style={[headerLayout.containerStyle, styles.headerBar]}>
          <SafeBlurView
            intensity={
              Platform.OS === 'ios' ? CHAT_HEADER_BLUR_INTENSITY_IOS : CHAT_HEADER_BLUR_INTENSITY_ANDROID
            }
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
            style={StyleSheet.absoluteFillObject}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              styles.headerBarFrostTint,
            ]}
          />
          <View
            style={[
              styles.headerNavRow,
              { minHeight: headerLayout.contentMinHeight },
            ]}
          >
            {mediaSelectionMode ? (
              <>
                <TouchableOpacity
                  onPress={exitMediaSelection}
                  disabled={busy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Отменить выделение"
                  style={styles.headerBackTouch}
                >
                  <View style={styles.headerIconWrap}>
                    <X size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
                  </View>
                </TouchableOpacity>
                <Text style={[styles.headerSelectionCount, { color: V.textPrimary }]}>
                  {selectedMediaIds.size}
                </Text>
                <TouchableOpacity
                  onPress={handleDeleteSelectedMedia}
                  disabled={busy || selectedMediaIds.size === 0}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Удалить выбранное"
                  style={[
                    styles.headerSelectionDeleteTouch,
                    (busy || selectedMediaIds.size === 0) && styles.headerActionDisabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={V.accentSage} />
                  ) : (
                    <Trash2 size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={goBackToChat}
                  disabled={busy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Назад"
                  style={[styles.headerBackTouch, busy && styles.headerActionDisabled]}
                >
                  <View style={styles.headerIconWrap}>
                    <ArrowLeft
                      size={ICON_SELECTION_ACTION}
                      color={V.textPrimary}
                      strokeWidth={1.5}
                    />
                  </View>
                </TouchableOpacity>
                <View style={styles.headerMenuSlot}>
                  <TouchableOpacity
                    onPress={() => setOverflowMenuVisible(true)}
                    disabled={busy}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Меню профиля"
                    style={[
                      styles.headerMenuTouch,
                      busy && styles.headerActionDisabled,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={V.accentSage} />
                    ) : (
                      <EllipsisVertical
                        size={ICON_SELECTION_ACTION}
                        color={V.textPrimary}
                        strokeWidth={1.5}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>

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

        <Animated.ScrollView
          ref={scrollRef}
          {...GAME_NO_OVERSCROLL_PROPS}
          nestedScrollEnabled
          scrollEventThrottle={16}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: scrollTopPadding,
              paddingBottom: PROFILE_COLLAPSE_DISTANCE + insets.bottom + 16,
              minHeight: minScrollContentHeight,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={scrollSnapHandler}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={wrapProfileScrollEnd(onScrollEndDrag)}
          onMomentumScrollEnd={wrapProfileScrollEnd(onMomentumScrollEnd)}
        >
          <Animated.View style={scrollContentPullStyle}>
            <View style={styles.sectionSpacer} />

            <ContactProfileMediaSection
              items={mediaItems}
              loading={mediaLoading}
              roomId={roomId}
              selectionMode={mediaSelectionMode}
              selectedIds={selectedMediaIds}
              hiddenTileId={hiddenTileId}
              onMediaPress={handleMediaPress}
              onMediaLongPress={handleMediaLongPress}
              onTileLayout={handleTileLayout}
              onRegisterTransitionSource={handleRegisterTransitionSource}
            />
          </Animated.View>
        </Animated.ScrollView>

        <View style={styles.floatingLayerUnder} pointerEvents="box-none">
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.actionsFloat,
              {
                top: actionsFloatTop,
                left: MESSENGER_HEADER_PADDING_HORIZONTAL,
                right: MESSENGER_HEADER_PADDING_HORIZONTAL,
              },
              actionsFloatStyle,
            ]}
          >
            <View style={styles.actionsRow}>
              <ContactProfileActionButton
                icon={<MessageCircle size={14} color={V.accentSage} strokeWidth={1.5} />}
                label="Сообщение"
                onPress={goBackToChat}
                disabled={busy || blocked}
              />
              <ContactProfileActionButton
                icon={<User size={14} color={V.textSecondary} strokeWidth={1.5} />}
                label="Контакты"
                onPress={goToContactsTab}
                disabled={busy}
              />
            </View>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.statusFloat, { top: statusStartY }, statusStyle]}
          >
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: contactOnline ? V.accentSage : V.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: contactOnline ? V.accentSage : V.textMuted },
                ]}
              >
                {contactOnline ? 'в сети' : 'не в сети'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.avatarFloat,
            {
              top: avatarTop,
              left: (profileLayoutW - PROFILE_AVATAR_SIZE) / 2,
              width: PROFILE_AVATAR_SIZE,
              height: PROFILE_AVATAR_SIZE,
              overflow: 'visible',
            },
            avatarWrapStyle,
          ]}
          collapsable={false}
        >
          <View style={styles.avatarCluster}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.avatarGlowOutlineInner,
                avatarGlowRingStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.avatarGlowOutlineOuter,
                avatarGlowRingSoftStyle,
              ]}
            />
            <Animated.View style={[styles.avatarGlowRing, avatarGlowStyle]}>
              <UserAvatar name={displayName} uri={peerAvatarUri} size={PROFILE_AVATAR_SIZE} />
              <Animated.View
                pointerEvents="none"
                style={[styles.avatarGlowFill, avatarGlowFillStyle]}
              />
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.nameHeaderChrome, nameHeaderChromeStackStyle]}
          pointerEvents="box-none"
        >
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.nameFloat,
              { top: nameStartY, left: profileLayoutW / 2, color: V.textPrimary },
              nameStyle,
            ]}
            numberOfLines={1}
            onLayout={onNameLayout}
          >
            {displayName}
          </Animated.Text>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.headerStatusFloat,
              { top: headerStatusTop, left: headerNameLeft },
              headerStatusStyle,
            ]}
          >
            <View style={styles.headerStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: contactOnline ? V.accentSage : V.textMuted },
                ]}
              />
              <Text
                style={[
                  styles.headerStatusText,
                  { color: contactOnline ? V.accentSage : V.textMuted },
                ]}
              >
                {contactOnline ? 'в сети' : 'не в сети'}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.headerMiniAvatar,
              {
                left: headerMiniAvatarLeft,
                top: headerMiniAvatarTop,
              },
              headerMiniAvatarStyle,
            ]}
          >
            <UserAvatar
              name={displayName}
              uri={peerAvatarUri}
              size={HEADER_MINI_AVATAR_SIZE}
            />
          </Animated.View>
        </Animated.View>
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
