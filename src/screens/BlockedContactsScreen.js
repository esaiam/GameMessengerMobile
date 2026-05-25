import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';
import TabBackground from '../components/TabBackground';
import { UserAvatar } from '../components/UserAvatar';
import { V } from '../theme';
import TabOverscrollFlatList from '../components/TabOverscrollFlatList';
import { ArrowLeft } from '../icons/lucideIcons';
import { getBlockedPeers, unblockPeer } from '../lib/blockedContacts';
import { normalizeUserPair } from '../utils/roomIds';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { profileStackGoBack, useProfileStackBackHandler } from '../lib/profileStackGoBack';

export default function BlockedContactsScreen({ route, navigation }) {
  useProfileStackBackHandler(navigation);
  const nickname = useNicknameFromRoute(route);
  const headerLayout = useMessengerHeaderLayout();
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyHandle, setBusyHandle] = useState(null);

  const loadBlocked = useCallback(async () => {
    if (!nickname) {
      setPeers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const set = await getBlockedPeers(nickname);
    setPeers([...set].sort());
    setLoading(false);
  }, [nickname]);

  useFocusEffect(
    useCallback(() => {
      loadBlocked();
    }, [loadBlocked]),
  );

  const runUnblock = useCallback(
    async (peerHandle) => {
      if (!nickname || !peerHandle) return;
      setBusyHandle(peerHandle);
      try {
        await unblockPeer(nickname, peerHandle);
        setPeers((prev) => prev.filter((p) => p !== peerHandle));
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

  const renderItem = ({ item }) => {
    const busy = busyHandle === item;
    return (
      <View
        style={[
          tw`flex-row items-center py-3 px-3 rounded-[10px] mb-2`,
          { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
        ]}
      >
        <TouchableOpacity
          style={tw`flex-1 flex-row items-center`}
          onPress={() => openContactProfile(item)}
          activeOpacity={0.7}
          disabled={busy}
        >
          <UserAvatar name={item} uri={null} size={44} />
          <View style={tw`flex-1 ml-3`}>
            <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
              {item}
            </Text>
            <Text style={[tw`text-[11px] mt-0.5`, { color: V.textMuted }]}>Профиль контакта</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Разблокировать', `Разблокировать ${item}?`, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Разблокировать', onPress: () => runUnblock(item) },
            ])
          }
          disabled={busy}
          style={[
            tw`rounded-[8px] px-3 py-1.5 ml-2`,
            { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.accentSage },
            busy && { opacity: 0.5 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={V.accentSage} />
          ) : (
            <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]}>Разблокировать</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TabBackground>
      <View style={[tw`flex-1`, { backgroundColor: 'transparent' }]}>
        <View style={[headerLayout.containerStyle, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            onPress={() => profileStackGoBack(navigation)}
            style={{
              minHeight: headerLayout.contentMinHeight,
              justifyContent: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={[tw`text-[14px] font-medium ml-2`, { color: V.textSecondary }]}>Назад</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-1 px-4`}>
          <Text style={[tw`text-[17px] font-medium mb-2`, { color: V.textPrimary }]}>
            Заблокированные
          </Text>
          <Text style={[tw`text-[12px] mb-4`, { color: V.textSecondary, lineHeight: 18 }]}>
            Эти пользователи скрыты из чатов и контактов. Разблокируйте, чтобы снова писать и видеть
            переписку.
          </Text>

          {loading ? (
            <View style={tw`py-8 items-center`}>
              <ActivityIndicator color={V.textMuted} />
            </View>
          ) : (
            <TabOverscrollFlatList
              style={tw`flex-1`}
              data={peers}
              keyExtractor={(item) => item}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={[tw`text-[13px] py-4`, { color: V.textMuted }]}>
                  Нет заблокированных контактов.
                </Text>
              }
            />
          )}
        </View>
      </View>
    </TabBackground>
  );
}
