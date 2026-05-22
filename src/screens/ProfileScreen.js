import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';
import { V } from '../theme';
import { supabase } from '../lib/supabase';
import { NICKNAME_STORAGE_KEY, useAuthGate } from '../context/AuthGateContext';
import { UserAvatar } from '../components/UserAvatar';
import ProfileAvatarModal from '../components/ProfileAvatarModal';
import ProfileEditHandleModal from '../components/ProfileEditHandleModal';
import { useLocalAvatar } from '../context/LocalAvatarContext';
import TabBackground from '../components/TabBackground';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { Camera, Pencil } from '../icons/lucideIcons';
import { registerPushToken } from '../lib/notifications';
import {
  DM_POLICY_LABELS,
  getChatWallpaperEnabled,
  getDmPolicy,
  setChatWallpaperEnabled,
  setDmPolicy } from '../lib/profileSettings';

const AVATAR_SIZE = 96;
const AVATAR_MARGIN_TOP = 8;
const NAME_MARGIN_TOP = 14;
const ACTIONS_MARGIN_TOP = 20;
const ACTION_ROW_HEIGHT = 58;
const COLLAPSE_DISTANCE = 132;
const NAME_LINE_HEIGHT = 22;

function RowButton({ title, subtitle, onPress, variant = 'default' }) {
  const color =
    variant === 'danger' ? '#E87171' : variant === 'primary' ? V.accentSage : V.textPrimary;
  return (
    <TouchableOpacity
      style={[tw`py-3`, { borderBottomWidth: 0.5, borderBottomColor: V.border }]}
      onPress={onPress}
      activeOpacity={0.7}
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
        style={[tw`text-[11px] mb-[6px]`, { color: V.textSecondary, fontWeight: '400' }]}
      >
        {title}
      </Text>
      <View
        style={[
          tw`rounded-[12px] px-4 overflow-hidden`,
          { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border }]}
      >
        {children}
      </View>
    </View>
  );
}

function ProfileActionButton({ icon, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.actionBtn, {backgroundColor: V.bgElevated, borderColor: V.border}]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color: V.textSecondary}]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ route, navigation }) {
  const nickname = useNicknameFromRoute(route);
  const { session } = useAuthGate();
  const { avatarUri, savePickedUri, removeAvatar } = useLocalAvatar();
  const [avatarModal, setAvatarModal] = useState(false);
  const [editHandleModal, setEditHandleModal] = useState(false);
  const [dmPolicyLabel, setDmPolicyLabel] = useState(DM_POLICY_LABELS.everyone);
  const [wallpaperOn, setWallpaperOn] = useState(true);
  const [pushStatusLabel, setPushStatusLabel] = useState('');
  const [nameWidth, setNameWidth] = useState(0);
  const headerLayout = useMessengerHeaderLayout();
  const { width: screenW } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const headerH = headerLayout.minHeight;
  const avatarTop = headerH + AVATAR_MARGIN_TOP;
  const nameStartY = avatarTop + AVATAR_SIZE + NAME_MARGIN_TOP;
  const nameEndY =
    headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - 9;
  const avatarLiftY = avatarTop - (headerLayout.paddingTop + headerLayout.contentMinHeight / 2 - AVATAR_SIZE / 2);
  const scrollTopPadding =
    AVATAR_MARGIN_TOP +
    AVATAR_SIZE +
    NAME_MARGIN_TOP +
    NAME_LINE_HEIGHT +
    ACTIONS_MARGIN_TOP +
    ACTION_ROW_HEIGHT;

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    } });

  const avatarWrapStyle = useAnimatedStyle(() => {
    const p = Math.min(scrollY.value / COLLAPSE_DISTANCE, 1);
    const translateY = interpolate(p, [0, 1], [0, -avatarLiftY]);
    const scale = interpolate(p, [0, 1], [1, 0]);
    const opacity = interpolate(p, [0, 0.72, 1], [1, 0.35, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }, { scale }] };
  });

  const nameStyle = useAnimatedStyle(() => {
    const p = Math.min(scrollY.value / COLLAPSE_DISTANCE, 1);
    const arcY = Math.sin(p * Math.PI * 0.5);
    const arcX = 1 - Math.cos(p * Math.PI * 0.5);
    const translateY = (nameEndY - nameStartY) * arcY;
    const half = (nameWidth || 120) / 2;
    const startTx = -half;
    const endTx = MESSENGER_HEADER_PADDING_HORIZONTAL - screenW / 2;
    const translateX = startTx + (endTx - startTx) * arcX;
    const fontSize = interpolate(p, [0, 1], [18, 17]);
    return {
      fontSize,
      transform: [{ translateX }, { translateY }] };
  });

  const refreshSettingsLabels = useCallback(async () => {
    const [policy, wallpaper, perm] = await Promise.all([
      getDmPolicy(),
      getChatWallpaperEnabled(),
      Notifications.getPermissionsAsync()]);
    setDmPolicyLabel(DM_POLICY_LABELS[policy] || DM_POLICY_LABELS.everyone);
    setWallpaperOn(wallpaper);
    const st = perm?.status;
    if (st === 'granted') setPushStatusLabel('Включены');
    else if (st === 'denied') setPushStatusLabel('Отклонены — откройте настройки системы');
    else setPushStatusLabel('Не запрошены');
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSettingsLabels();
    }, [refreshSettingsLabels])
  );

  const openInvites = () => {
    const tabNav = navigation.getParent?.();
    if (tabNav?.navigate) {
      tabNav.navigate('Profile', { screen: 'InviteFriends' });
    } else {
      navigation.navigate('InviteFriends');
    }
  };

  const pickPhotoFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Доступ', 'Разрешите доступ к галерее в настройках устройства.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) await savePickedUri(asset.uri);
    } catch {
      Alert.alert('Ошибка', 'Не удалось выбрать фото.');
    }
  };

  const onHandleSaved = (slug) => {
    navigation.setParams({ nickname: slug });
    const tabNav = navigation.getParent?.();
    tabNav?.setParams?.({ nickname: slug });
  };

  const openDmPolicyPicker = () => {
    Alert.alert('Кто может написать мне', 'Выберите вариант', [
      {
        text: DM_POLICY_LABELS.everyone,
        onPress: async () => {
          await setDmPolicy('everyone');
          setDmPolicyLabel(DM_POLICY_LABELS.everyone);
        } },
      {
        text: DM_POLICY_LABELS.contacts,
        onPress: async () => {
          await setDmPolicy('contacts');
          setDmPolicyLabel(DM_POLICY_LABELS.contacts);
        } },
      {
        text: DM_POLICY_LABELS.nobody,
        onPress: async () => {
          await setDmPolicy('nobody');
          setDmPolicyLabel(DM_POLICY_LABELS.nobody);
        } },
      { text: 'Отмена', style: 'cancel' }]);
  };

  const openNotifications = async () => {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status === 'granted') {
      Alert.alert('Уведомления', 'Push-уведомления включены.', [
        {
          text: 'Настройки системы',
          onPress: () => Linking.openSettings() },
        { text: 'OK', style: 'cancel' }]);
      return;
    }
    if (perm.status === 'denied') {
      Alert.alert(
        'Уведомления',
        'Разрешение отклонено. Включите уведомления в настройках системы.',
        [
          { text: 'Открыть настройки', onPress: () => Linking.openSettings() },
          { text: 'Отмена', style: 'cancel' }]
      );
      return;
    }
    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert('Ошибка', 'Нет сессии.');
      return;
    }
    const token = await registerPushToken(uid);
    await refreshSettingsLabels();
    if (token) {
      Alert.alert('Готово', 'Уведомления включены.');
    } else {
      Alert.alert('Не удалось', 'Разрешите уведомления или проверьте сеть.');
    }
  };

  const openAppearance = () => {
    Alert.alert('Внешний вид', 'Обои в чатах', [
      {
        text: 'Включить обои',
        onPress: async () => {
          await setChatWallpaperEnabled(true);
          setWallpaperOn(true);
        } },
      {
        text: 'Выключить обои',
        onPress: async () => {
          await setChatWallpaperEnabled(false);
          setWallpaperOn(false);
        } },
      { text: 'Отмена', style: 'cancel' }]);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(NICKNAME_STORAGE_KEY);
  };

  const deleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт',
      'Профиль и локальные данные будут удалены. Войти снова можно только с новым @handle.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Подтвердите',
              'Это действие необратимо для вашего профиля в Vault.',
              [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Удалить навсегда',
                  style: 'destructive',
                  onPress: async () => {
                    const uid = session?.user?.id;
                    if (!uid) {
                      Alert.alert('Ошибка', 'Нет сессии.');
                      return;
                    }
                    try {
                      await supabase.from('profiles').delete().eq('id', uid);
                      await removeAvatar();
                      await AsyncStorage.multiRemove([
                        NICKNAME_STORAGE_KEY,
                        '@vault_session_cache']);
                      await supabase.auth.signOut();
                    } catch (e) {
                      Alert.alert('Ошибка', e?.message || 'Не удалось удалить аккаунт.');
                    }
                  } }]
            );
          } }]
    );
  };

  const displayName = nickname ? `@${nickname}` : '@гость';

  return (
    <TabBackground>
      <View style={[headerLayout.containerStyle, styles.headerBar]} />

      <View style={styles.floatingLayer} pointerEvents="box-none">
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.avatarFloat,
            {
              top: avatarTop,
              left: (screenW - AVATAR_SIZE) / 2,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE },
            avatarWrapStyle]}
        >
          <UserAvatar
            name={nickname}
            uri={avatarUri}
            size={AVATAR_SIZE}
            onPress={() => setAvatarModal(true)}
          />
        </Animated.View>

        <Animated.Text
          pointerEvents="none"
          style={[
            styles.nameFloat,
            { top: nameStartY, left: screenW / 2, color: V.textPrimary },
            nameStyle]}
          numberOfLines={1}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && w !== nameWidth) setNameWidth(w);
          }}
        >
          {displayName}
        </Animated.Text>
      </View>

      <Animated.ScrollView
        style={tw`flex-1`}
        contentContainerStyle={[
          tw`px-4 pb-10`,
          {
            backgroundColor: 'transparent',
            paddingTop: scrollTopPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.actionsRow}>
          <ProfileActionButton
            icon={<Camera size={16} color={V.accentSage} strokeWidth={1.5} />}
            label="Выбрать фото"
            onPress={pickPhotoFromGallery}
          />
          <ProfileActionButton
            icon={<Pencil size={16} color={V.accentSage} strokeWidth={1.5} />}
            label="Изменить"
            onPress={() => setEditHandleModal(true)}
          />
        </View>

        <View style={tw`mb-7`} />

        <Section title="ОСНОВНОЕ">
          <RowButton title="Пригласить пользователя" onPress={openInvites} variant="primary" />
        </Section>

        <Section title="ПРИВАТНОСТЬ">
          <RowButton
            title="Кто может написать мне"
            subtitle={dmPolicyLabel}
            onPress={openDmPolicyPicker}
          />
        </Section>

        <Section title="ПРИЛОЖЕНИЕ">
          {__DEV__ && (
            <RowButton
              title="Хранилище"
              subtitle="Кэш голоса и превью видео"
              onPress={() => navigation.navigate('Storage')}
              variant="primary"
            />
          )}
          <RowButton
            title="Уведомления"
            subtitle={pushStatusLabel}
            onPress={openNotifications}
          />
          <RowButton
            title="Внешний вид"
            subtitle={wallpaperOn ? 'Обои чата: включены' : 'Обои чата: выключены'}
            onPress={openAppearance}
          />
        </Section>

        <Section title="АККАУНТ">
          <RowButton title="Выйти" onPress={logout} variant="danger" />
          <RowButton title="Удалить аккаунт" onPress={deleteAccount} variant="danger" />
        </Section>

        <ProfileAvatarModal
          visible={avatarModal}
          onClose={() => setAvatarModal(false)}
          nickname={nickname}
        />
        <ProfileEditHandleModal
          visible={editHandleModal}
          onClose={() => setEditHandleModal(false)}
          currentHandle={nickname}
          onSaved={onHandleSaved}
        />
      </Animated.ScrollView>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: 'transparent',
    zIndex: 8 },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20 },
  avatarFloat: {
    position: 'absolute',
    zIndex: 21 },
  nameFloat: {
    position: 'absolute',
    zIndex: 21,
    fontWeight: '500',
    maxWidth: '92%',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    justifyContent: 'center' },
  actionBtn: {
    flex: 1,
    maxWidth: 160,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8 },
  actionLabel: {
    fontSize: 12,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {})
  } });
