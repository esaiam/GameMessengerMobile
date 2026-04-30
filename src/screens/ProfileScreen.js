import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from 'twrnc';
import { V } from '../theme';
import { supabase } from '../lib/supabase';
import { NICKNAME_STORAGE_KEY } from '../context/AuthGateContext';
import { UserAvatar } from '../components/UserAvatar';
import ProfileAvatarModal from '../components/ProfileAvatarModal';
import { useLocalAvatar } from '../context/LocalAvatarContext';
import TabBackground from '../components/TabBackground';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';

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
      <Text pointerEvents="none" style={[tw`text-[13px] font-medium`, { color }]}>
        {title}
      </Text>
      {!!subtitle && (
        <Text
          pointerEvents="none"
          style={[tw`text-[11px] mt-1`, { color: V.textSecondary }]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={tw`mb-4`}>
      <Text
        pointerEvents="none"
        style={[
          tw`text-[11px] mb-[6px]`,
          { color: V.textSecondary, fontWeight: '400' },
        ]}
      >
        {title}
      </Text>
      <View
        style={[
          tw`rounded-[12px] px-4 overflow-hidden`,
          { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen({ route, navigation }) {
  const nickname = route.params?.nickname || '';
  const { avatarUri } = useLocalAvatar();
  const [avatarModal, setAvatarModal] = useState(false);
  const headerLayout = useMessengerHeaderLayout();

  const openInvites = () => {
    const tabNav = navigation.getParent?.();
    if (tabNav?.navigate) {
      tabNav.navigate('Profile', { screen: 'InviteFriends' });
    } else {
      navigation.navigate('InviteFriends');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(NICKNAME_STORAGE_KEY);
  };

  return (
    <TabBackground>
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={[
          tw`px-4 pb-10`,
          { backgroundColor: 'transparent', paddingTop: headerLayout.paddingTop },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={tw`flex-row items-center mb-5`}>
          <UserAvatar
            name={nickname}
            uri={avatarUri}
            size={56}
            onPress={() => setAvatarModal(true)}
          />
          <View style={tw`ml-3 flex-1 min-w-0`}>
            <View style={tw`flex-row items-center`}>
              <Text
                style={[tw`text-[15px] font-medium flex-1 min-w-0`, { color: V.textPrimary }]}
                numberOfLines={1}
              >
                @{nickname || 'гость'}
              </Text>
              <TouchableOpacity
                onPress={() => Alert.alert('Скоро')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[tw`text-[13px] font-medium ml-2`, { color: V.accentSage }]}>
                  Редактировать
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Section title="ОСНОВНОЕ">
          <RowButton
            title="Пригласить пользователя"
            onPress={openInvites}
            variant="primary"
          />
        </Section>

        <Section title="ПРИВАТНОСТЬ">
          <RowButton
            title="Кто может написать мне"
            onPress={() => Alert.alert('Скоро')}
          />
        </Section>

        <Section title="ПРИЛОЖЕНИЕ">
          <RowButton title="Уведомления" onPress={() => Alert.alert('Скоро')} />
          <RowButton title="Внешний вид" onPress={() => Alert.alert('Скоро')} />
        </Section>

        <Section title="АККАУНТ">
          <RowButton title="Выйти" onPress={logout} variant="danger" />
          <RowButton
            title="Удалить аккаунт"
            onPress={() => Alert.alert('Скоро')}
            variant="danger"
          />
        </Section>

        <ProfileAvatarModal
          visible={avatarModal}
          onClose={() => setAvatarModal(false)}
          nickname={nickname}
        />
      </ScrollView>
    </TabBackground>
  );
}
