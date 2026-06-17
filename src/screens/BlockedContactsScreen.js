import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import TabBackground from '../components/TabBackground';
import { UserAvatar } from '../components/UserAvatar';
import { V } from '../theme';
import TabOverscrollFlatList from '../components/TabOverscrollFlatList';
import { ArrowLeft } from '../icons/lucideIcons';
import { getBlockedPeers, unblockPeer } from '../lib/blockedContacts';
import { requestChatsListReload } from '../lib/chatsListSync';
import { normalizeUserPair } from '../utils/roomIds';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { profileStackGoBack, useProfileStackBackHandler } from '../lib/profileStackGoBack';

const CARD_RADIUS = 12;
const UNBLOCK_BTN_H = 36;

function BlockedContactRow({ peerHandle, busy, onOpenProfile, onUnblock }) {
  return (
    <View style={styles.rowCard}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={() => onOpenProfile(peerHandle)}
        activeOpacity={0.7}
        disabled={busy}
      >
        <UserAvatar name={peerHandle} uri={null} size={44} />
        <View style={styles.rowTextCol}>
          <Text style={styles.peerName} numberOfLines={1}>
            {peerHandle}
          </Text>
          <Text style={styles.peerHint}>Профиль контакта</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() =>
          Alert.alert('Разблокировать', `Разблокировать ${peerHandle}?`, [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Разблокировать', onPress: () => onUnblock(peerHandle) },
          ])
        }
        disabled={busy}
        style={[styles.unblockBtn, busy && styles.unblockBtnBusy]}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator size="small" color={V.accentSage} />
        ) : (
          <Text style={styles.unblockBtnText}>Разблокировать</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function BlockedContactsScreen({ route, navigation }) {
  useProfileStackBackHandler(navigation);
  const nickname = useNicknameFromRoute(route);
  const headerLayout = useMessengerHeaderLayout();
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyHandle, setBusyHandle] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
    setLoading(true);
  }, [nickname]);

  const loadBlocked = useCallback(async ({ silent = false } = {}) => {
    if (!nickname) {
      setPeers([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }
    if (!silent && !hasLoadedRef.current) {
      setLoading(true);
    }
    const set = await getBlockedPeers(nickname);
    setPeers([...set].sort());
    setLoading(false);
    hasLoadedRef.current = true;
  }, [nickname]);

  useFocusEffect(
    useCallback(() => {
      loadBlocked({ silent: hasLoadedRef.current });
    }, [loadBlocked]),
  );

  const runUnblock = useCallback(
    async (peerHandle) => {
      if (!nickname || !peerHandle) return;
      setBusyHandle(peerHandle);
      try {
        await unblockPeer(nickname, peerHandle);
        setPeers((prev) => prev.filter((p) => p !== peerHandle));
        requestChatsListReload();
      } catch (e) {
        Alert.alert('Ошибка', e?.message || 'Не удалось разблокировать');
      } finally {
        setBusyHandle(null);
      }
    },
    [nickname],
  );

  const openContactProfile = useCallback(
    (peerHandle) => {
      if (!nickname || !peerHandle) return;
      const { roomId } = normalizeUserPair(nickname, peerHandle);
      navigation.navigate('ContactProfile', {
        peerName: peerHandle,
        nickname,
        roomId,
        contactOnline: false,
      });
    },
    [nickname, navigation],
  );

  const renderItem = ({ item }) => (
    <BlockedContactRow
      peerHandle={item}
      busy={busyHandle === item}
      onOpenProfile={openContactProfile}
      onUnblock={runUnblock}
    />
  );

  return (
    <TabBackground>
      <View style={styles.screen}>
        <View style={[headerLayout.containerStyle, styles.header]}>
          <TouchableOpacity
            onPress={() => profileStackGoBack(navigation)}
            style={[styles.backBtn, { minHeight: headerLayout.contentMinHeight }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={styles.backText}>Назад</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Заблокированные</Text>
          <Text style={styles.lead}>
            Блокировка на сервере: заблокированные не могут вам писать. Разблокируйте, чтобы снова
            видеть переписку и писать.
          </Text>

          <View style={styles.listWrap}>
            <TabOverscrollFlatList
              style={styles.list}
              data={peers}
              keyExtractor={(item) => item}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                loading ? null : (
                  <Text style={styles.emptyText}>Нет заблокированных контактов.</Text>
                )
              }
            />
            {loading && peers.length === 0 ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={V.textMuted} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'transparent',
  },
  backBtn: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: V.textSecondary,
    marginLeft: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: V.textPrimary,
    marginBottom: 8,
  },
  lead: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: V.textSecondary,
    marginBottom: 16,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    color: V.textMuted,
    paddingVertical: 16,
    lineHeight: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.bgChatsScreen,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: CARD_RADIUS,
    backgroundColor: V.glassNeutralBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  rowTextCol: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  peerName: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
  },
  peerHint: {
    fontSize: 11,
    fontWeight: '400',
    color: V.textMuted,
    marginTop: 2,
  },
  unblockBtn: {
    height: UNBLOCK_BTN_H,
    borderRadius: UNBLOCK_BTN_H / 2,
    paddingHorizontal: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.btnPrimaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
  },
  unblockBtnBusy: {
    opacity: 0.5,
  },
  unblockBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: V.accentSage,
  },
});
