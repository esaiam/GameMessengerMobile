import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  BackHandler,
  Share,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, EllipsisVertical, MessageCircle, User, X, Trash2 } from '../icons/lucideIcons';
import { UserAvatar } from '../components/UserAvatar';
import { GAME_NO_OVERSCROLL_PROPS, V } from '../theme';
import TabBackground from '../components/TabBackground';
import {
  MESSENGER_HEADER_CONTENT_MIN_HEIGHT,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';
import SafeBlurView from '../components/SafeBlurView';
import {
  CHAT_HEADER_BLUR_INTENSITY_ANDROID,
  CHAT_HEADER_BLUR_INTENSITY_IOS,
  CHAT_HEADER_FROST_TINT_OPACITY,
  ICON_SELECTION_ACTION,
} from '../components/ChatRoomHeader';
import {
  HEADER_MINI_AVATAR_SIZE,
  PROFILE_AVATAR_SIZE,
  PROFILE_COLLAPSE_DISTANCE,
  useProfileCollapseHeader,
} from '../hooks/useProfileCollapseHeader';
import {
  blockPeer,
  unblockPeer,
  isBlocked,
} from '../lib/blockedContacts';
import { hideChatRoom } from '../lib/hiddenChats';
import { hideAllRoomMessagesForMe, hideMessagesForMe } from '../lib/hideRoomMessagesForMe';
import { getContactAlias, setContactAlias } from '../lib/contactAliases';
import { supabase } from '../lib/supabase';
import { clearContactsListCache } from '../components/contacts/useContactsList';
import { loadDialogsCache, saveDialogsCache } from '../utils/dialogsCache';
import {
  leaveContactProfileAfterDestructiveAction,
  safeGoBackFromContactProfile,
} from '../lib/safeGoBack';
import { useContactProfileSwipeBack } from '../hooks/useContactProfileSwipeBack';
import { useContactProfileRoomMedia } from '../hooks/useContactProfileRoomMedia';
import ContactProfileMediaSection from '../components/contactProfile/ContactProfileMediaSection';
import ContactProfileMediaViewerModal from '../components/contactProfile/ContactProfileMediaViewerModal';
import ContactProfileOverflowMenuModal from '../components/contactProfile/ContactProfileOverflowMenuModal';
import ContactProfileEditContactModal from '../components/contactProfile/ContactProfileEditContactModal';
import {
  adjustMediaTransitionRectForScroll,
  isValidMediaTransitionRect,
} from '../components/contactProfile/mediaTransitionSource';

/** Зазор под шапкой до аватара (~80–100px; в хуке AVATAR_MARGIN_TOP = −12) */
const CONTACT_PROFILE_AVATAR_BELOW_HEADER = 96;

export default function ContactProfileScreen({ route, navigation }) {
  const { peerName, contactOnline, roomId, nickname } = route.params || {};
  const insets = useSafeAreaInsets();
  const headerLayout = useMessengerHeaderLayout();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { items: mediaItems, loading: mediaLoading, reload: reloadMedia } =
    useContactProfileRoomMedia(roomId, nickname);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [openedMediaId, setOpenedMediaId] = useState(null);
  /** Плитка скрыта в сетке, пока viewer открыт / идёт close fly-out */
  const [hiddenTileId, setHiddenTileId] = useState(null);
  /** Rect плитки при open (hero transition source). */
  const [viewerOriginLayout, setViewerOriginLayout] = useState(null);
  const [viewerOpenEpoch, setViewerOpenEpoch] = useState(0);
  const transitionSourcesRef = useRef(new Map());
  const transitionMeasureFnsRef = useRef(new Map());
  const profileScrollYRef = useRef(0);
  const profileScrollYAtOpenRef = useRef(0);
  const mediaViewerRef = useRef(null);
  const viewerOpeningRef = useRef(false);
  const [mediaSelectionMode, setMediaSelectionMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState(() => new Set());
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [editContactVisible, setEditContactVisible] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState('');

  const viewerItems = useMemo(
    () =>
      mediaItems
        .filter((m) => m.media_url)
        .map((m) => ({
          id: m.id,
          uri: m.media_url,
          kind: m.message_type === 'video' ? 'video' : 'image',
        })),
    [mediaItems],
  );

  const exitMediaSelection = useCallback(() => {
    setMediaSelectionMode(false);
    setSelectedMediaIds(new Set());
  }, []);

  const toggleMediaSelection = useCallback((id) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setMediaSelectionMode(false);
      return next;
    });
  }, []);

  const handleMediaLongPress = useCallback(
    (item) => {
      if (!item?.id || !item.media_url) return;
      setViewerVisible(false);
      setHiddenTileId(null);
      setOpenedMediaId(null);
      setViewerOriginLayout(null);
      setMediaSelectionMode(true);
      setSelectedMediaIds(new Set([item.id]));
    },
    [],
  );

  const handleTileLayout = useCallback((id, layout) => {
    if (isValidMediaTransitionRect(layout)) {
      transitionSourcesRef.current.set(id, layout);
    }
  }, []);

  const handleRegisterTransitionSource = useCallback((id, fn) => {
    if (fn) transitionMeasureFnsRef.current.set(id, fn);
    else transitionMeasureFnsRef.current.delete(id);
  }, []);

  const getTransitionSource = useCallback((itemId) => {
    const rect = transitionSourcesRef.current.get(itemId);
    return isValidMediaTransitionRect(rect) ? rect : null;
  }, []);

  /** Свежий measureInWindow плитки перед close fly-out. */
  const remeasureTransitionSource = useCallback((itemId) => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (layout) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (isValidMediaTransitionRect(layout)) {
          transitionSourcesRef.current.set(itemId, layout);
          resolve(layout);
          return;
        }
        resolve(getTransitionSource(itemId));
      };
      const timer = setTimeout(() => finish(getTransitionSource(itemId)), 120);
      const measure = transitionMeasureFnsRef.current.get(itemId);
      if (!measure) {
        finish(getTransitionSource(itemId));
        return;
      }
      try {
        measure((layout) => finish(layout));
      } catch {
        finish(getTransitionSource(itemId));
      }
    });
  }, [getTransitionSource]);

  const rememberProfileScrollY = useCallback((e) => {
    profileScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const wrapProfileScrollEnd = useCallback(
    (handler) => (e) => {
      rememberProfileScrollY(e);
      handler?.(e);
    },
    [rememberProfileScrollY],
  );

  /** Window-rect ячейки с учётом скролла профиля с момента open. */
  const getCloseTransitionSource = useCallback(() => {
    const mediaId = openedMediaId;
    const base =
      (mediaId ? getTransitionSource(mediaId) : null) ??
      (isValidMediaTransitionRect(viewerOriginLayout) ? viewerOriginLayout : null);
    if (!base) return null;
    const scrollDelta = profileScrollYRef.current - profileScrollYAtOpenRef.current;
    return adjustMediaTransitionRectForScroll(base, scrollDelta);
  }, [openedMediaId, viewerOriginLayout, getTransitionSource]);

  const handleMediaPress = useCallback(
    (item, layout) => {
      if (!item?.media_url) return;
      if (viewerVisible || viewerOpeningRef.current) return;
      if (mediaSelectionMode) {
        toggleMediaSelection(item.id);
        return;
      }
      const measured = layout ?? getTransitionSource(item.id);
      if (isValidMediaTransitionRect(measured)) {
        transitionSourcesRef.current.set(item.id, measured);
      }
      const idx = viewerItems.findIndex((m) => m.id === item.id);
      if (idx < 0) return;

      viewerOpeningRef.current = true;
      setViewerIndex(idx);
      setViewerOriginLayout(measured);
      setOpenedMediaId(item.id);
      setHiddenTileId(item.id);
      profileScrollYAtOpenRef.current = profileScrollYRef.current;

      setViewerOpenEpoch((e) => e + 1);
      setViewerVisible(true);
      viewerOpeningRef.current = false;
    },
    [viewerItems, viewerVisible, mediaSelectionMode, toggleMediaSelection, getTransitionSource],
  );

  const handoffMediaViewerTile = useCallback(() => {
    setHiddenTileId(null);
  }, []);

  const dismissMediaViewer = useCallback(() => {
    viewerOpeningRef.current = false;
    setViewerVisible(false);
    setOpenedMediaId(null);
    setViewerOriginLayout(null);
  }, []);

  const handleViewerIndexChange = useCallback(
    (nextIndex) => {
      const id = viewerItems[nextIndex]?.id;
      setViewerIndex(nextIndex);
      if (!id) return;
      setOpenedMediaId(id);
      setHiddenTileId(id);
      const layout = getTransitionSource(id);
      if (layout) setViewerOriginLayout(layout);
    },
    [viewerItems, getTransitionSource],
  );

  const handleDeleteSelectedMedia = useCallback(() => {
    if (!nickname || selectedMediaIds.size === 0) return;
    const count = selectedMediaIds.size;
    Alert.alert(
      'Удалить у меня',
      `Скрыть ${count} ${count === 1 ? 'медиа' : 'медиа'} у вас?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await hideMessagesForMe({
                messageIds: [...selectedMediaIds],
                nickname,
                roomId,
              });
              exitMediaSelection();
              await reloadMedia();
            } catch (e) {
              Alert.alert('Ошибка', e?.message || 'Не удалось удалить');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [
    nickname,
    roomId,
    selectedMediaIds,
    exitMediaSelection,
    reloadMedia,
  ]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (viewerVisible) {
          mediaViewerRef.current?.close();
          return true;
        }
        if (mediaSelectionMode) {
          exitMediaSelection();
          return true;
        }
        safeGoBackFromContactProfile(navigation);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [navigation, viewerVisible, mediaSelectionMode, exitMediaSelection]),
  );

  const {
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
    onNameLayout,
    headerHeight,
    headerUnderGlowTop,
    headerUnderGlowHeight,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowStyle,
    profileChromeStackStyle,
  } = useProfileCollapseHeader({
    headerLayout,
    screenW,
    withStatusRow: true,
    withAvatarScrollGlow: true,
    avatarTopExtra: CONTACT_PROFILE_AVATAR_BELOW_HEADER,
  });

  useEffect(() => {
    if (!nickname || !peerName) return;
    isBlocked(nickname, peerName).then(setBlocked);
  }, [nickname, peerName]);

  useEffect(() => {
    if (!nickname || !peerName) {
      setLocalDisplayName('');
      return;
    }
    getContactAlias(nickname, peerName).then(setLocalDisplayName);
  }, [nickname, peerName]);

  const goBackToChat = useCallback(() => {
    safeGoBackFromContactProfile(navigation);
  }, [navigation]);

  const swipeBackGesture = useContactProfileSwipeBack(goBackToChat);

  const goToContactsTab = () => {
    navigation.getParent()?.navigate('Contacts', { screen: 'ContactsHome' });
  };

  const pruneDialogsCache = useCallback(async () => {
    if (!nickname || !roomId) return;
    const cached = await loadDialogsCache(nickname);
    if (!cached?.length) return;
    const next = cached.filter((r) => r.roomId !== roomId);
    await saveDialogsCache(nickname, next);
  }, [nickname, roomId]);

  const runDeleteContact = useCallback(async () => {
    if (!roomId || !nickname) {
      Alert.alert('Ошибка', 'Нет комнаты для удаления контакта.');
      return;
    }
    setBusy(true);
    try {
      await hideAllRoomMessagesForMe({ roomId, nickname });
      await hideChatRoom(nickname, roomId);
      await pruneDialogsCache();
      clearContactsListCache(nickname);
      leaveContactProfileAfterDestructiveAction(navigation);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось удалить контакт');
    } finally {
      setBusy(false);
    }
  }, [roomId, nickname, navigation, pruneDialogsCache]);

  const handleDeleteContact = () => {
    Alert.alert(
      'Удалить контакт',
      'Контакт и переписка будут скрыты только у вас.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: runDeleteContact },
      ],
    );
  };

  const handleShareContact = useCallback(async () => {
    if (!peerName) return;
    let message = `Контакт в Vault Messenger: ${peerName}`;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('handle')
        .eq('id', peerName)
        .maybeSingle();
      const handle = typeof data?.handle === 'string' ? data.handle.trim() : '';
      if (handle) message = `Контакт в Vault Messenger: @${handle}`;
    } catch {
      /* share fallback */
    }
    try {
      await Share.share({ message });
    } catch {
      /* user dismissed */
    }
  }, [peerName]);

  const handleEditContact = useCallback(() => {
    setEditContactVisible(true);
  }, []);

  const handleSaveContactAlias = useCallback(
    async (alias) => {
      if (!nickname || !peerName) return;
      setBusy(true);
      try {
        await setContactAlias(nickname, peerName, alias);
        setLocalDisplayName(alias);
      } catch (e) {
        Alert.alert('Ошибка', e?.message || 'Не удалось сохранить имя');
      } finally {
        setBusy(false);
      }
    },
    [nickname, peerName],
  );

  const runBlock = useCallback(async () => {
    if (!peerName || !nickname) return;
    setBusy(true);
    try {
      await blockPeer(nickname, peerName);
      setBlocked(true);
      if (roomId) {
        await hideAllRoomMessagesForMe({ roomId, nickname });
        await hideChatRoom(nickname, roomId);
        await pruneDialogsCache();
      }
      Alert.alert('Готово', `${peerName} заблокирован.`);
      leaveContactProfileAfterDestructiveAction(navigation, { afterBlock: true });
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось заблокировать');
    } finally {
      setBusy(false);
    }
  }, [peerName, nickname, roomId, navigation, pruneDialogsCache]);

  const runUnblock = useCallback(async () => {
    if (!peerName || !nickname) return;
    setBusy(true);
    try {
      await unblockPeer(nickname, peerName);
      setBlocked(false);
      Alert.alert('Готово', `${peerName} разблокирован.`);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось разблокировать');
    } finally {
      setBusy(false);
    }
  }, [peerName, nickname]);

  const handleBlock = () => {
    if (blocked) {
      Alert.alert('Разблокировать', `Разблокировать ${peerName}?`, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Разблокировать', onPress: runUnblock },
      ]);
      return;
    }
    Alert.alert(
      'Заблокировать',
      `Заблокировать ${peerName}? Переписка скроется у вас.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Заблокировать', style: 'destructive', onPress: runBlock },
      ],
    );
  };

  const displayName = localDisplayName || peerName || '—';

  const minScrollContentHeight =
    screenH - headerLayout.minHeight + PROFILE_COLLAPSE_DISTANCE + 32;

  const content = (
    <TabBackground>
      <Animated.View style={[styles.flexRoot, profileChromeStackStyle]}>
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
            colors={['rgba(201,168,76,0.2)', 'transparent']}
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
          <View style={styles.actionsRow}>
            <ActionButton
              icon={<MessageCircle size={14} color={V.accentSage} strokeWidth={1.5} />}
              label="Сообщение"
              onPress={goBackToChat}
              disabled={busy || blocked}
            />
            <ActionButton
              icon={<User size={14} color={V.textSecondary} strokeWidth={1.5} />}
              label="Контакты"
              onPress={goToContactsTab}
              disabled={busy}
            />
          </View>

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
        </Animated.ScrollView>
      </Animated.View>

      <View style={styles.floatingLayerUnder} pointerEvents="box-none">
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.avatarFloat,
            {
              top: avatarTop,
              left: (screenW - PROFILE_AVATAR_SIZE) / 2,
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
              <UserAvatar name={peerName || '?'} uri={null} size={PROFILE_AVATAR_SIZE} />
            </Animated.View>
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

      <View style={styles.floatingLayerOver} pointerEvents="box-none">
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.nameFloat,
            { top: nameStartY, left: screenW / 2, color: V.textPrimary },
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
            styles.headerMiniAvatar,
            {
              left: headerMiniAvatarLeft,
              top: headerMiniAvatarTop,
            },
            headerMiniAvatarStyle,
          ]}
        >
          <UserAvatar
            name={peerName || '?'}
            uri={null}
            size={HEADER_MINI_AVATAR_SIZE}
          />
        </Animated.View>
      </View>
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

function ActionButton({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.actionBtn,
        { backgroundColor: V.bgElevated, borderColor: V.border },
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color: V.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  flexRoot: {
    flex: 1,
    position: 'relative',
  },
  headerBar: {
    overflow: 'hidden',
    zIndex: 2,
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
    zIndex: 5,
  },
  floatingLayerOver: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  avatarFloat: {
    position: 'absolute',
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
    borderWidth: 2,
    borderColor: V.accentGold,
    top: -8,
    left: -8,
  },
  avatarGlowOutlineOuter: {
    position: 'absolute',
    width: PROFILE_AVATAR_SIZE + 28,
    height: PROFILE_AVATAR_SIZE + 28,
    borderRadius: (PROFILE_AVATAR_SIZE + 28) / 2,
    borderWidth: 4,
    borderColor: V.accentGold,
    top: -14,
    left: -14,
  },
  avatarGlowRing: {
    borderWidth: 2,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  nameFloat: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '500',
    maxWidth: '92%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  statusFloat: {
    position: 'absolute',
    zIndex: 21,
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
