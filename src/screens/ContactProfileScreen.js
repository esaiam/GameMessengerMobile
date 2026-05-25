import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle, User } from '../icons/lucideIcons';
import { UserAvatar } from '../components/UserAvatar';
import { V } from '../theme';
import TabOverscrollScrollView from '../components/TabOverscrollScrollView';
import {
  blockPeer,
  unblockPeer,
  isBlocked } from '../lib/blockedContacts';
import { hideChatRoom } from '../lib/hiddenChats';
import { hideAllRoomMessagesForMe } from '../lib/hideRoomMessagesForMe';
import { loadDialogsCache, saveDialogsCache } from '../utils/dialogsCache';
import {
  leaveContactProfileAfterDestructiveAction,
  safeGoBackFromContactProfile,
  useContactProfileBackHandler } from '../lib/safeGoBack';
import { useContactProfileSwipeBack } from '../hooks/useContactProfileSwipeBack';

export default function ContactProfileScreen({ route, navigation }) {
  const { peerName, contactOnline, roomId, nickname } = route.params || {};
  const insets = useSafeAreaInsets();
  useContactProfileBackHandler(navigation);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);

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
        { text: 'Удалить', style: 'destructive', onPress: runDeleteConversation }]
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
        { text: 'Разблокировать', onPress: runUnblock }]);
      return;
    }
    Alert.alert(
      'Заблокировать',
      `Заблокировать ${peerName}? Переписка скроется у вас.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Заблокировать', style: 'destructive', onPress: runBlock }]
    );
  };

  const content = (
    <View style={[styles.root, { backgroundColor: V.bgApp }]}>
      <View
        style={[
          styles.headerBar,
          { paddingTop: insets.top + 10, borderBottomColor: V.border }]}
      >
        <TouchableOpacity
          onPress={goBackToChat}
          disabled={busy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={V.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: V.textPrimary }]} numberOfLines={1}>
          {peerName || 'Профиль'}
        </Text>
        <View style={styles.backBtn}>
          {busy ? <ActivityIndicator size="small" color={V.accentSage} /> : null}
        </View>
      </View>

      <TabOverscrollScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <UserAvatar name={peerName || '?'} uri={null} size={80} />
          <Text
            style={[styles.nameText, { color: V.textPrimary }]}
            numberOfLines={1}
          >
            {peerName || '—'}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: contactOnline ? V.accentSage : V.textMuted }]}
            />
            <Text
              style={[
                styles.statusText,
                { color: contactOnline ? V.accentSage : V.textMuted}]}
            >
              {contactOnline ? 'в сети' : 'не в сети'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <ActionButton
            icon={<MessageCircle size={16} color={V.accentSage} strokeWidth={1.5} />}
            label="Сообщение"
            onPress={goBackToChat}
            disabled={busy || blocked}
          />
          <ActionButton
            icon={<User size={16} color={V.textSecondary} strokeWidth={1.5} />}
            label="Контакты"
            onPress={goToContactsTab}
            disabled={busy}
          />
        </View>

        <View
          style={[
            styles.dangerCard,
            { backgroundColor: V.bgSurface, borderColor: V.border }]}
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
      </TabOverscrollScrollView>
    </View>
  );

  return swipeBackGesture ? (
    <GestureDetector gesture={swipeBackGesture}>
      {content}
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
        disabled && styles.disabled]}
    >
      {icon}
      <Text
        style={[styles.actionLabel, { color: V.textMuted}]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DangerRow({ label, onPress, disabled, last }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.dangerRow, last ? null : null, disabled && styles.disabled]}
    >
      <Text style={[styles.dangerLabel, { color: V.dangerMuted}]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    alignItems: 'center' },
  identity: {
    alignItems: 'center',
    marginBottom: 32 },
  nameText: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '500',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6 },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6 },
  statusText: {
    fontSize: 13,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
    alignSelf: 'stretch',
    justifyContent: 'center' },
  actionBtn: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8 },
  actionLabel: {
    fontSize: 12,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  dangerCard: {
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden' },
  separator: {
    height: StyleSheet.hairlineWidth },
  dangerRow: {
    paddingHorizontal: 16,
    paddingVertical: 14 },
  dangerLabel: {
    fontSize: 14,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  disabled: {
    opacity: 0.45 } });
