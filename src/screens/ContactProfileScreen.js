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
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle, User, X, Trash2 } from '../icons/lucideIcons';
import { UserAvatar } from '../components/UserAvatar';
import { GAME_NO_OVERSCROLL_PROPS, V } from '../theme';
import TabBackground from '../components/TabBackground';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import {
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
import { loadDialogsCache, saveDialogsCache } from '../utils/dialogsCache';
import {
  leaveContactProfileAfterDestructiveAction,
  safeGoBackFromContactProfile,
} from '../lib/safeGoBack';
import { useContactProfileSwipeBack } from '../hooks/useContactProfileSwipeBack';
import { useContactProfileRoomMedia } from '../hooks/useContactProfileRoomMedia';
import ContactProfileMediaSection from '../components/contactProfile/ContactProfileMediaSection';
import ContactProfileMediaViewerModal from '../components/contactProfile/ContactProfileMediaViewerModal';

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
  const [viewerOriginLayout, setViewerOriginLayout] = useState(null);
  const [viewerOpenEpoch, setViewerOpenEpoch] = useState(0);
  const tileLayoutsRef = useRef(new Map());
  const tileMeasureFnsRef = useRef(new Map());
  const mediaViewerRef = useRef(null);
  const [mediaSelectionMode, setMediaSelectionMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState(() => new Set());

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
      setMediaSelectionMode(true);
      setSelectedMediaIds(new Set([item.id]));
    },
    [],
  );

  const handleTileLayout = useCallback((id, layout) => {
    tileLayoutsRef.current.set(id, layout);
  }, []);

  const handleRegisterTileMeasure = useCallback((id, fn) => {
    if (fn) tileMeasureFnsRef.current.set(id, fn);
    else tileMeasureFnsRef.current.delete(id);
  }, []);

  const getMediaOriginLayout = useCallback((itemId) => {
    return tileLayoutsRef.current.get(itemId) ?? null;
  }, []);

  /** Замороженный rect ячейки для fly-out — без unhide плитки до конца анимации. */
  const getCloseOriginLayout = useCallback(() => {
    const mediaId = openedMediaId;
    if (!mediaId) return viewerOriginLayout;
    return tileLayoutsRef.current.get(mediaId) ?? viewerOriginLayout ?? null;
  }, [openedMediaId, viewerOriginLayout]);

  const handleMediaPress = useCallback(
    (item, layout) => {
      if (!item?.media_url) return;
      if (mediaSelectionMode) {
        toggleMediaSelection(item.id);
        return;
      }
      const measured = layout ?? tileLayoutsRef.current.get(item.id) ?? null;
      if (measured) tileLayoutsRef.current.set(item.id, measured);
      const idx = viewerItems.findIndex((m) => m.id === item.id);
      if (idx < 0) return;
      setViewerIndex(idx);
      setViewerOriginLayout(measured);
      setOpenedMediaId(item.id);
      setViewerOpenEpoch((e) => e + 1);
      setViewerVisible(true);
    },
    [viewerItems, mediaSelectionMode, toggleMediaSelection],
  );

  const closeMediaViewer = useCallback(() => {
    setViewerVisible(false);
    requestAnimationFrame(() => {
      setOpenedMediaId(null);
      setViewerOriginLayout(null);
    });
  }, []);

  const handleViewerIndexChange = useCallback(
    (nextIndex) => {
      setViewerIndex(nextIndex);
      const id = viewerItems[nextIndex]?.id;
      if (!id) return;
      setOpenedMediaId(id);
      const layout = tileLayoutsRef.current.get(id);
      if (layout) setViewerOriginLayout(layout);
    },
    [viewerItems],
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
    nameStyle,
    statusStyle,
    onNameLayout,
  } = useProfileCollapseHeader({ headerLayout, screenW, withStatusRow: true });

  useEffect(() => {
    if (!nickname || !peerName) return;
    isBlocked(nickname, peerName).then(setBlocked);
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

  const runDeleteConversation = useCallback(async () => {
    if (!roomId || !nickname) {
      Alert.alert('Ошибка', 'Нет комнаты для удаления переписки.');
      return;
    }
    setBusy(true);
    try {
      await hideAllRoomMessagesForMe({ roomId, nickname });
      await hideChatRoom(nickname, roomId);
      await pruneDialogsCache();
      leaveContactProfileAfterDestructiveAction(navigation);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось удалить переписку');
    } finally {
      setBusy(false);
    }
  }, [roomId, nickname, navigation, pruneDialogsCache]);

  const handleDeleteConversation = () => {
    Alert.alert(
      'Удалить переписку',
      'Переписка будет удалена только у вас.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: runDeleteConversation },
      ],
    );
  };

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

  const displayName = peerName || '—';

  const minScrollContentHeight =
    screenH - headerLayout.minHeight + PROFILE_COLLAPSE_DISTANCE + 32;

  const content = (
    <TabBackground>
      <View style={styles.flex}>
        <View style={[headerLayout.containerStyle, styles.headerBar]}>
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
                  style={styles.headerSide}
                >
                  <X size={22} color={V.textPrimary} strokeWidth={1.5} />
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
                    styles.headerSideRight,
                    selectedMediaIds.size === 0 && styles.headerActionDisabled,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={V.accentSage} />
                  ) : (
                    <Trash2 size={22} color={V.textPrimary} strokeWidth={1.5} />
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
                  style={styles.headerSide}
                >
                  <ArrowLeft size={22} color={V.textPrimary} strokeWidth={1.5} />
                </TouchableOpacity>
                <View style={styles.headerSideRight}>
                  {busy ? <ActivityIndicator size="small" color={V.accentSage} /> : null}
                </View>
              </>
            )}
          </View>
        </View>

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
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
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

          <View
            style={[
              styles.dangerCard,
              { backgroundColor: V.bgSurface, borderColor: V.border },
            ]}
          >
            <DangerRow
              label={blocked ? 'Разблокировать' : 'Заблокировать'}
              onPress={handleBlock}
              disabled={busy}
            />
            <View style={[styles.separator, { backgroundColor: V.border }]} />
            <DangerRow
              label="Удалить переписку"
              onPress={handleDeleteConversation}
              disabled={busy || !roomId}
              last
            />
          </View>

          <ContactProfileMediaSection
            items={mediaItems}
            loading={mediaLoading}
            roomId={roomId}
            selectionMode={mediaSelectionMode}
            selectedIds={selectedMediaIds}
            openedMediaId={viewerVisible ? openedMediaId : null}
            onMediaPress={handleMediaPress}
            onMediaLongPress={handleMediaLongPress}
            onTileLayout={handleTileLayout}
            onRegisterMeasure={handleRegisterTileMeasure}
          />
        </Animated.ScrollView>
      </View>

      <View style={styles.floatingLayer} pointerEvents="box-none">
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.avatarFloat,
            {
              top: avatarTop,
              left: (screenW - PROFILE_AVATAR_SIZE) / 2,
              width: PROFILE_AVATAR_SIZE,
              height: PROFILE_AVATAR_SIZE,
            },
            avatarWrapStyle,
          ]}
          collapsable={false}
        >
          <UserAvatar name={peerName || '?'} uri={null} size={PROFILE_AVATAR_SIZE} />
        </Animated.View>

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
      <ContactProfileMediaViewerModal
        ref={mediaViewerRef}
        visible={viewerVisible}
        items={viewerItems}
        viewIndex={viewerIndex}
        initialOriginLayout={viewerOriginLayout}
        openEpoch={viewerOpenEpoch}
        getOriginLayout={getMediaOriginLayout}
        onClose={closeMediaViewer}
        onIndexChange={handleViewerIndexChange}
        getCloseOriginLayout={getCloseOriginLayout}
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

function DangerRow({ label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.dangerRow, disabled && styles.disabled]}
    >
      <Text style={[styles.dangerLabel, { color: V.dangerMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerBar: {
    backgroundColor: 'transparent',
    zIndex: 8,
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSideRight: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerSelectionCount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
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
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  avatarFloat: {
    position: 'absolute',
    zIndex: 21,
  },
  nameFloat: {
    position: 'absolute',
    zIndex: 21,
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
  dangerCard: {
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  dangerRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerLabel: {
    fontSize: 14,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  disabled: {
    opacity: 0.45,
  },
});
