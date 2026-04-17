import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { CommonActions } from '@react-navigation/native';
import tw from 'twrnc';
import { V } from '../theme';
import { UserAvatar } from '../components/UserAvatar';
import ProfileAvatarModal from '../components/ProfileAvatarModal';
import { useLocalAvatar } from '../context/LocalAvatarContext';
import TabBackground from '../components/TabBackground';

const NICKNAME_KEY = '@backgammon_nickname';

function RowButton({ title, subtitle, onPress, variant = 'default' }) {
  const color =
    variant === 'danger' ? '#E87171' : variant === 'primary' ? V.accentSage : V.textPrimary;
  return (
    <TouchableOpacity
      style={[
        tw`py-3`,
        { borderBottomWidth: 0.5, borderBottomColor: V.border },
      ]}
      onPress={onPress}
    >
      <Text style={[tw`text-[13px] font-medium`, { color }]}>{title}</Text>
      {!!subtitle && (
        <Text style={[tw`text-[11px] mt-1`, { color: V.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ route, navigation }) {
  const nickname = route.params?.nickname || '';
  const inviteCode = useMemo(() => nickname || '—', [nickname]);
  const { avatarUri } = useLocalAvatar();
  const [avatarModal, setAvatarModal] = useState(false);

  const copyInvite = async () => {
    try {
      await Clipboard.setStringAsync(inviteCode);
      Alert.alert('Скопировано', 'Инвайт-код скопирован в буфер обмена.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось скопировать код.');
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(NICKNAME_KEY);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  };

  return (
    <TabBackground>
      <View style={[tw`flex-1 pt-12 px-4`, { backgroundColor: 'transparent' }]}>
        <Text style={[tw`text-[17px] font-medium mb-4`, { color: V.textPrimary }]}>Профиль</Text>

        <View style={tw`flex-row items-center mb-5`}>
          <UserAvatar
            name={nickname}
            uri={avatarUri}
            size={56}
            onPress={() => setAvatarModal(true)}
          />
          <View style={tw`ml-3 flex-1`}>
            <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
              {nickname || 'Гость'}
            </Text>
            <Text style={[tw`text-[11px] mt-1`, { color: V.textSecondary }]}>Твой инвайт-код</Text>
            <Text style={[tw`text-[12px] mt-0.5`, { color: V.textMuted }]}>{inviteCode}</Text>
          </View>
        </View>

        <View
          style={[
            tw`rounded-[12px] px-4`,
            { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
          ]}
        >
          <RowButton
            title="Пригласить нового пользователя"
            subtitle="Скопировать инвайт-код и отправить другу"
            onPress={copyInvite}
            variant="primary"
          />
          <RowButton
            title="Настройки"
            subtitle="Скоро: уведомления, приватность, тема"
            onPress={() => Alert.alert('Настройки', 'Скоро.')}
          />
          <RowButton
            title="Выйти"
            subtitle="Удалит локальный никнейм на этом устройстве"
            onPress={logout}
            variant="danger"
          />
        </View>

        <ProfileAvatarModal
          visible={avatarModal}
          onClose={() => setAvatarModal(false)}
          nickname={nickname}
        />
      </View>
    </TabBackground>
  );
}

