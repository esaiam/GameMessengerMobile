import 'react-native-get-random-values';
import { ready as libsodiumReady } from 'react-native-libsodium';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule } from 'expo-audio';

import { LocalAvatarProvider } from './src/context/LocalAvatarContext';
import { AuthGateProvider, useAuthGate } from './src/context/AuthGateContext';
import RecoverPasswordScreen from './src/screens/RecoverPasswordScreen';
import { V } from './src/theme';
import {
  VAULT_PENDING_INVITE_KEY,
  parsePendingInvite,
  serializePendingInvite,
} from './src/utils/inviteRedeem';
import { registerPushToken } from './src/lib/notifications';
import { RootNavigationTree } from './src/navigation/RootNavigationTree';
import { MainTabSwipeOverlay } from './src/navigation/useMainTabSwipeGesture';
import { parseInviteQrPayload } from './src/utils/inviteDeepLink';
import { parseAuthRecoveryFromUrl } from './src/utils/authRecoveryDeepLink';

/** RFC2606 .invalid — плейсхолдер до signUp (AuthScreen перезапишет serializePendingInvite с реальным email). */
const VAULT_DEEPLINK_PENDING_EMAIL = 'pending-invite@invalid';

function BootstrapSplash() {
  return (
    <View style={{ flex: 1, backgroundColor: V.bgApp, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: V.textPrimary, fontSize: 13, fontWeight: '400' }}>Загрузка...</Text>
    </View>
  );
}

function AppNavigationRoot() {
  const navRef = useRef(null);
  const pushTokenRegisteredForUserRef = useRef(null);
  const {
    bootstrapped,
    session,
    profileStatus,
    profileHandle,
    inviteCheckDone,
    passwordRecoveryPending,
  } = useAuthGate();

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      pushTokenRegisteredForUserRef.current = null;
      return;
    }
    if (!profileHandle) return;
    if (pushTokenRegisteredForUserRef.current === uid) return;
    pushTokenRegisteredForUserRef.current = uid;
    registerPushToken(uid).catch(() => {});
  }, [session?.user?.id, profileHandle]);

  if (!bootstrapped) {
    return <BootstrapSplash />;
  }
  if (session && passwordRecoveryPending) {
    return (
      <View style={{ flex: 1, backgroundColor: V.bgApp }}>
        <StatusBar style="light" />
        <RecoverPasswordScreen />
      </View>
    );
  }
  if (session && (!inviteCheckDone || profileStatus === 'loading')) {
    return <BootstrapSplash />;
  }

  const stackKey = !session ? 'auth' : !profileHandle ? 'pick' : `main-${profileHandle}`;

  const navTree = (
    <RootNavigationTree
      navRef={navRef}
      stackKey={stackKey}
      session={session}
      profileHandle={profileHandle}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: V.bgApp }}>
      <PermissionBanner />
      <MainTabSwipeOverlay navRef={navRef}>{navTree}</MainTabSwipeOverlay>
    </View>
  );
}

function PermissionBanner() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
          /** На Android запрос микрофона при старте иногда роняет процесс; микрофон запрашивается при записи в чате. */
          const mic =
            Platform.OS === 'android'
              ? { granted: true }
              : await AudioModule.requestRecordingPermissionsAsync();
          if (cancelled) return;
          if (!cam.granted || !lib.granted || !mic.granted) {
            setMessage(
              Platform.OS === 'android'
                ? 'Часть разрешений не выдана. Камера и галерея — в настройках устройства. Микрофон — при первой записи голоса.'
                : 'Часть разрешений не выдана. Камера, галерея и микрофон можно включить в настройках устройства.'
            );
          }
        } catch {
          if (!cancelled) {
            setMessage('Не удалось запросить разрешения. Проверь настройки устройства.');
          }
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  if (!message) return null;

  return (
    <Pressable
      onPress={() => setMessage(null)}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: V.bgSurface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: V.border,
      }}
    >
      <Text style={{ color: V.textSecondary, fontSize: 12, fontWeight: '400' }}>{message}</Text>
    </Pressable>
  );
}

export default function App() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url || cancelled) return;
        if (parseAuthRecoveryFromUrl(url)) return;
        const code = parseInviteQrPayload(url);
        if (!code) return;
        const existing = await AsyncStorage.getItem(VAULT_PENDING_INVITE_KEY);
        const parsed = parsePendingInvite(existing);
        if (parsed && parsed.email && parsed.email !== VAULT_DEEPLINK_PENDING_EMAIL) {
          return;
        }
        await AsyncStorage.setItem(
          VAULT_PENDING_INVITE_KEY,
          serializePendingInvite(VAULT_DEEPLINK_PENDING_EMAIL, code)
        );
      } catch (e) {
        console.warn('[Vault] initial invite URL:', e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    libsodiumReady
      .then(() => console.log('[Vault] libsodium ready'))
      .catch((e) => console.error('[Vault] libsodium init failed:', e));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocalAvatarProvider>
          <AuthGateProvider>
            <AppNavigationRoot />
          </AuthGateProvider>
        </LocalAvatarProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
