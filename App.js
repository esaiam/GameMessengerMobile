import 'react-native-get-random-values';
import { ready as libsodiumReady } from 'react-native-libsodium';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule } from 'expo-audio';

import { LocalAvatarProvider } from './src/context/LocalAvatarContext';
import { AuthGateProvider, useAuthGate } from './src/context/AuthGateContext';
import AuthScreen from './src/screens/AuthScreen';
import RecoverPasswordScreen from './src/screens/RecoverPasswordScreen';
import InviteScanScreen from './src/screens/InviteScanScreen';
import PickHandleScreen from './src/screens/PickHandleScreen';
import GameScreen from './src/screens/GameScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import InviteFriendsScreen from './src/screens/InviteFriendsScreen';
import PokerHubScreen from './src/screens/PokerHubScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import { MessageCircle, Layers, User, Users } from './src/icons/lucideIcons';
import { V } from './src/theme';
import GlassTabBar from './src/components/GlassTabBar';
import { parseInviteQrPayload } from './src/utils/inviteDeepLink';
import { parseAuthRecoveryFromUrl } from './src/utils/authRecoveryDeepLink';
import {
  VAULT_PENDING_INVITE_KEY,
  parsePendingInvite,
  serializePendingInvite,
} from './src/utils/inviteRedeem';

/** RFC2606 .invalid — плейсхолдер до signUp (AuthScreen перезапишет serializePendingInvite с реальным email). */
const VAULT_DEEPLINK_PENDING_EMAIL = 'pending-invite@invalid';

const BG = '#0D0F14';
const TAB_ACTIVE = V.accentSage;
const TAB_INACTIVE = '#5A5750';

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: BG,
    card: BG,
    primary: BG,
    border: BG,
  },
};

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const ChatsStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const PokerStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TAB_ORDER = ['Chats', 'Contacts', 'Poker', 'Profile'];
const SWIPE_DISABLED_DEEPEST = new Set(['Room', 'Game', 'ChatRoom']);

function getDeepestRouteName(state) {
  let s = state;
  while (s && s.routes && typeof s.index === 'number') {
    const r = s.routes[s.index];
    if (!r?.state) return r?.name || null;
    s = r.state;
  }
  return null;
}

function getActiveTabName(state) {
  let s = state;
  let lastTab = null;
  while (s && s.routes && typeof s.index === 'number') {
    const r = s.routes[s.index];
    if (r?.name && TAB_ORDER.includes(r.name)) lastTab = r.name;
    s = r?.state;
  }
  return lastTab;
}

function ChatsStackNavigator() {
  return (
    <ChatsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <ChatsStack.Screen name="ChatsList" component={ChatsScreen} />
      <ChatsStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <ChatsStack.Screen name="Room" component={GameScreen} />
      <ChatsStack.Screen name="Game" component={GameScreen} />
    </ChatsStack.Navigator>
  );
}

function ContactsStackNavigator() {
  return (
    <ContactsStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <ContactsStack.Screen name="ContactsHome" component={ContactsScreen} />
      <ContactsStack.Screen name="Room" component={GameScreen} />
      <ContactsStack.Screen name="Game" component={GameScreen} />
    </ContactsStack.Navigator>
  );
}

function PokerStackNavigator() {
  return (
    <PokerStack.Navigator screenOptions={{ headerShown: false }}>
      <PokerStack.Screen name="PokerHub" component={PokerHubScreen} />
    </PokerStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
    </ProfileStack.Navigator>
  );
}

function MainTabs({ route }) {
  const nickname = route.params?.nickname;

  return (
    <Tabs.Navigator
      initialRouteName="Chats"
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="Chats"
        component={ChatsStackNavigator}
        initialParams={{ nickname }}
        options={{
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="Contacts"
        component={ContactsStackNavigator}
        initialParams={{ nickname }}
        options={{
          tabBarIcon: ({ color }) => <Users color={color} size={22} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="Poker"
        component={PokerStackNavigator}
        initialParams={{ nickname }}
        options={{
          tabBarActiveTintColor: '#C9A84C',
          tabBarInactiveTintColor: TAB_INACTIVE,
          tabBarIcon: ({ color }) => <Layers color={color} size={22} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileStackNavigator}
        initialParams={{ nickname }}
        options={{
          tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={1.8} />,
        }}
      />
    </Tabs.Navigator>
  );
}

function BootstrapSplash() {
  return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: V.textPrimary, fontSize: 13, fontWeight: '400' }}>Загрузка...</Text>
    </View>
  );
}

function AppNavigationRoot() {
  const navRef = useRef(null);
  const {
    bootstrapped,
    session,
    profileStatus,
    profileHandle,
    inviteCheckDone,
    passwordRecoveryPending,
  } = useAuthGate();

  const swipeTabsGesture = useMemo(() => {
    const MIN_DIST = 70;
    const MIN_VELOCITY = 650;

    return Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .onEnd((e) => {
        const nav = navRef.current;
        if (!nav) return;

        const state = nav.getRootState?.();
        if (!state) return;

        const deepest = getDeepestRouteName(state);
        if (deepest && SWIPE_DISABLED_DEEPEST.has(deepest)) return;

        const currentTab = getActiveTabName(state);
        if (!currentTab) return;

        const idx = TAB_ORDER.indexOf(currentTab);
        if (idx < 0) return;

        const tx = e.translationX ?? 0;
        const vx = e.velocityX ?? 0;
        const absTx = Math.abs(tx);
        const absVx = Math.abs(vx);

        const isSwipe = absTx >= MIN_DIST || absVx >= MIN_VELOCITY;
        if (!isSwipe) return;

        const dir = tx === 0 ? (vx < 0 ? -1 : 1) : (tx < 0 ? -1 : 1);
        const nextIdx = idx + (dir < 0 ? 1 : -1);
        if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return;

        const nextTab = TAB_ORDER[nextIdx];
        nav.navigate?.('Main', { screen: nextTab });
      });
  }, []);

  if (!bootstrapped) {
    return <BootstrapSplash />;
  }
  if (session && passwordRecoveryPending) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
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
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navRef} theme={NavTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          key={stackKey}
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: BG },
            animation: 'slide_from_right',
          }}
        >
          {!session ? (
            <>
              <Stack.Screen name="Auth" component={AuthScreen} />
              <Stack.Screen
                name="InviteScan"
                component={InviteScanScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                  contentStyle: { backgroundColor: BG },
                }}
              />
            </>
          ) : !profileHandle ? (
            <Stack.Screen name="PickHandle" component={PickHandleScreen} />
          ) : (
            <Stack.Screen
              name="Main"
              component={MainTabs}
              initialParams={{ nickname: profileHandle }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <PermissionBanner />
      {Platform.OS === 'android' ? (
        navTree
      ) : (
        <GestureDetector gesture={swipeTabsGesture}>{navTree}</GestureDetector>
      )}
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
