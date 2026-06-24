import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import * as ImagePicker from 'expo-image-picker';

import * as Notifications from 'expo-notifications';

import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

import { GAME_NO_OVERSCROLL_PROPS, V } from '../theme';

import { supabase } from '../lib/supabase';

import { useAuthGate } from '../context/AuthGateContext';

import { clearVaultLocalSession } from '../lib/vaultLocalSessionCleanup';
import { deleteUserAccount } from '../lib/deleteUserAccount';

import { UserAvatar } from '../components/UserAvatar';

import ProfileAvatarModal from '../components/ProfileAvatarModal';

import ProfileEditHandleModal from '../components/ProfileEditHandleModal';

import ProfileActionSheet from '../components/ProfileActionSheet';

import { useLocalAvatar } from '../context/LocalAvatarContext';

import TabBackground from '../components/TabBackground';
import SafeBlurView from '../components/SafeBlurView';
import {
  CHAT_HEADER_BLUR_INTENSITY_ANDROID,
  CHAT_HEADER_BLUR_INTENSITY_IOS,
  CHAT_HEADER_FROST_TINT_OPACITY,
} from '../components/ChatRoomHeader';
import {
  MESSENGER_HEADER_PADDING_HORIZONTAL,
  useMessengerHeaderLayout,
} from '../components/MessengerHeaderLayout';
import {
  HEADER_MINI_AVATAR_SIZE,
  PROFILE_AVATAR_SIZE,
  PROFILE_COLLAPSE_DISTANCE,
  useProfileCollapseHeader,
} from '../hooks/useProfileCollapseHeader';
import { CHATS_HEADER_GLOW_STOP_CENTER } from '../components/chats/ChatsHeaderGlow';

import { useNicknameFromRoute } from '../hooks/useNicknameFromRoute';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';

import { Camera, Pencil } from '../icons/lucideIcons';

import { registerPushToken, clearPushToken } from '../lib/notifications';
import { profileAvatarSaveErrorMessage } from '../lib/profileAvatarUpload';

import {
  getChatWallpaperEnabled,
  setChatWallpaperEnabled,
} from '../lib/profileSettings';

import { getBlockedPeers } from '../lib/blockedContacts';

/** Зазор под шапкой до аватара — как ContactProfileScreen */
const PROFILE_TAB_AVATAR_BELOW_HEADER = 96;

function RowButton({ title, subtitle, onPress, variant = 'default', disabled = false }) {

  const color =

    variant === 'danger' ? V.dangerMuted : variant === 'primary' ? V.accentSage : V.textPrimary;

  return (

    <TouchableOpacity

      style={[tw`py-3`, { borderBottomWidth: 0.5, borderBottomColor: V.border }]}

      onPress={onPress}

      activeOpacity={0.7}

      disabled={disabled}

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

          { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border }]}

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

      style={[styles.actionBtn, { backgroundColor: V.bgSurface, borderColor: V.border }]}

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

  const { avatarUri, savePickedUri, removeAvatar, uploading, refreshAvatar } = useLocalAvatar();

  const [avatarModal, setAvatarModal] = useState(false);

  const [editHandleModal, setEditHandleModal] = useState(false);

  const [actionSheet, setActionSheet] = useState(null);

  const closeActionSheet = () => setActionSheet(null);

  const showActionSheet = (config) => setActionSheet(config);

  const [wallpaperOn, setWallpaperOn] = useState(true);

  const [pushStatusLabel, setPushStatusLabel] = useState('');

  const [blockedCount, setBlockedCount] = useState(0);

  const [deletingAccount, setDeletingAccount] = useState(false);

  const headerLayout = useMessengerHeaderLayout();
  const insets = useSafeAreaInsets();
  const isTablet = useIsSplitLayout();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [profilePaneWidth, setProfilePaneWidth] = useState(screenW);
  const profileLayoutW = isTablet ? profilePaneWidth : screenW;

  useEffect(() => {
    if (!isTablet) {
      setProfilePaneWidth(screenW);
    }
  }, [isTablet, screenW]);

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
    avatarWrapStyle,
    avatarGlowStyle,
    avatarGlowFillStyle,
    avatarGlowRingStyle,
    avatarGlowRingSoftStyle,
    nameStyle,
    onNameLayout,
    headerMiniAvatarLeft,
    headerMiniAvatarTop,
    headerMiniAvatarStyle,
    headerUnderGlowTop,
    headerUnderGlowHeight,
    headerUnderGlowStyle,
    profileChromeStackStyle,
    nameHeaderChromeStackStyle,
  } = useProfileCollapseHeader({
    headerLayout,
    screenW: profileLayoutW,
    withStatusRow: false,
    withAvatarScrollGlow: true,
    avatarTopExtra: PROFILE_TAB_AVATAR_BELOW_HEADER,
  });

  const handleProfilePaneLayout = useCallback((e) => {
    if (!isTablet) return;
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setProfilePaneWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    }
  }, [isTablet]);

  const minScrollContentHeight =
    screenH - headerLayout.minHeight + PROFILE_COLLAPSE_DISTANCE + 32;

  const refreshSettingsLabels = useCallback(async () => {

    const [wallpaper, perm, blocked] = await Promise.all([
      getChatWallpaperEnabled(),
      Notifications.getPermissionsAsync(),
      nickname ? getBlockedPeers(nickname) : Promise.resolve(new Set()),
    ]);

    setWallpaperOn(wallpaper);

    setBlockedCount(blocked.size);

    const st = perm?.status;

    if (st === 'granted') setPushStatusLabel('Включены');

    else if (st === 'denied') setPushStatusLabel('Отклонены — откройте настройки системы');

    else setPushStatusLabel('Не запрошены');

  }, [nickname]);



  useFocusEffect(
    useCallback(() => {
      refreshSettingsLabels();
      void refreshAvatar();
    }, [refreshSettingsLabels, refreshAvatar]),
  );



  const openInvites = () => {
    navigation.navigate('InviteFriends');
  };

  const pickPhotoFromGallery = async () => {
    if (uploading) return;

    try {

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {

        showActionSheet({

          title: 'Доступ',

          message: 'Разрешите доступ к галерее в настройках устройства.',

          options: [{ label: 'OK' }],

          showCancel: false });

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
    } catch (e) {
      showActionSheet({
        title: 'Ошибка',
        message: profileAvatarSaveErrorMessage(e?.message),
        options: [{ label: 'OK' }],
        showCancel: false });
    }
  };



  const onHandleSaved = (slug) => {

    navigation.setParams({ nickname: slug });

    const tabNav = navigation.getParent?.();

    tabNav?.setParams?.({ nickname: slug });

  };



  const openNotifications = async () => {

    const perm = await Notifications.getPermissionsAsync();

    if (perm.status === 'granted') {

      showActionSheet({

        title: 'Уведомления',

        message: 'Push-уведомления включены.',

        options: [

          { label: 'Настройки системы', onPress: () => Linking.openSettings() },

          { label: 'OK' }],

        showCancel: false });

      return;

    }

    if (perm.status === 'denied') {

      showActionSheet({

        title: 'Уведомления',

        message: 'Разрешение отклонено. Включите уведомления в настройках системы.',

        options: [

          { label: 'Открыть настройки', onPress: () => Linking.openSettings() }] });

      return;

    }

    const uid = session?.user?.id;

    if (!uid) {

      showActionSheet({

        title: 'Ошибка',

        message: 'Нет сессии.',

        options: [{ label: 'OK' }],

        showCancel: false });

      return;

    }

    const token = await registerPushToken(uid);

    await refreshSettingsLabels();

    if (token) {

      showActionSheet({

        title: 'Готово',

        message: 'Уведомления включены.',

        options: [{ label: 'OK' }],

        showCancel: false });

    } else {

      showActionSheet({

        title: 'Не удалось',

        message: 'Разрешите уведомления или проверьте сеть.',

        options: [{ label: 'OK' }],

        showCancel: false });

    }

  };



  const openAppearance = () => {

    showActionSheet({

      title: 'Внешний вид',

      message: 'Обои в чатах',

      options: [

        {

          label: 'Включить обои',

          onPress: async () => {

            await setChatWallpaperEnabled(true);

            setWallpaperOn(true);

          } },

        {

          label: 'Выключить обои',

          onPress: async () => {

            await setChatWallpaperEnabled(false);

            setWallpaperOn(false);

          } }] });

  };



  const logout = async () => {
    const uid = session?.user?.id;
    try {
      if (uid) await clearPushToken(uid);
      await clearVaultLocalSession();
    } catch (e) {
      if (__DEV__) console.warn('[Profile] logout cleanup', e?.message || e);
    }
    await supabase.auth.signOut();
  };



  const performDeleteAccount = async () => {
    if (deletingAccount) return;

    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert('Ошибка', 'Нет сессии.');
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteUserAccount();
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось удалить аккаунт.');
      setDeletingAccount(false);
    }
  };

  const deleteAccount = () => {
    if (deletingAccount) return;

    Alert.alert(
      'Удалить аккаунт?',
      'Все ваши данные, сообщения и ключи будут удалены безвозвратно.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => void performDeleteAccount() },
      ],
    );
  };



  const displayName = nickname ? `@${nickname}` : '@гость';

  return (
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
            style={[StyleSheet.absoluteFillObject, styles.headerBarFrostTint]}
          />
          <View
            style={[styles.headerNavRow, { minHeight: headerLayout.contentMinHeight }]}
          />
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
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          <Animated.View style={scrollContentPullStyle}>
            <View style={styles.sectionSpacer} />

            <Section title="ОСНОВНОЕ">
              <RowButton title="Пригласить пользователя" onPress={openInvites} variant="primary" />
            </Section>

            <Section title="ПРИВАТНОСТЬ">
              <RowButton
                title="Заблокированные контакты"
                subtitle={
                  blockedCount > 0
                    ? `${blockedCount} — нажмите, чтобы разблокировать`
                    : 'Список пуст'
                }
                onPress={() => navigation.navigate('BlockedContacts')}
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
              <RowButton title="Выйти" onPress={logout} variant="danger" disabled={deletingAccount} />
              <RowButton
                title="Удалить аккаунт"
                onPress={deleteAccount}
                variant="danger"
                disabled={deletingAccount}
              />
            </Section>
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
              <ProfileActionButton
                icon={<Camera size={14} color={V.accentSage} strokeWidth={1.5} />}
                label="Выбрать фото"
                onPress={pickPhotoFromGallery}
              />
              <ProfileActionButton
                icon={<Pencil size={14} color={V.textSecondary} strokeWidth={1.5} />}
                label="Изменить"
                onPress={() => setEditHandleModal(true)}
              />
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
              style={[styles.avatarGlowOutlineInner, avatarGlowRingStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.avatarGlowOutlineOuter, avatarGlowRingSoftStyle]}
            />
            <Animated.View style={[styles.avatarGlowRing, avatarGlowStyle]}>
              <UserAvatar
                name={nickname}
                uri={avatarUri}
                size={PROFILE_AVATAR_SIZE}
                onPress={() => setAvatarModal(true)}
              />
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
              styles.headerMiniAvatar,
              { left: headerMiniAvatarLeft, top: headerMiniAvatarTop },
              headerMiniAvatarStyle,
            ]}
          >
            <UserAvatar
              name={nickname}
              uri={avatarUri}
              size={HEADER_MINI_AVATAR_SIZE}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>

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



      <ProfileActionSheet

        visible={!!actionSheet}

        onClose={closeActionSheet}

        title={actionSheet?.title}

        message={actionSheet?.message}

        options={actionSheet?.options}

        showCancel={actionSheet?.showCancel ?? true}

      />

      {deletingAccount ? (
        <View style={styles.deletingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={V.accentSage} />
        </View>
      ) : null}

    </TabBackground>

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
    zIndex: 8,
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
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMiniAvatar: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  floatingLayerUnder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  actionsFloat: {
    position: 'absolute',
  },
  nameHeaderChrome: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarFloat: {
    position: 'absolute',
    zIndex: 4,
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
    top: -8,
    left: -8,
  },
  avatarGlowOutlineOuter: {
    position: 'absolute',
    width: PROFILE_AVATAR_SIZE + 28,
    height: PROFILE_AVATAR_SIZE + 28,
    borderRadius: (PROFILE_AVATAR_SIZE + 28) / 2,
    top: -14,
    left: -14,
  },
  avatarGlowRing: {
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  avatarGlowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    backgroundColor: V.accentSage,
  },
  nameFloat: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: '92%',
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
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,15,20,0.72)',
  },
});


