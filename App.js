import 'react-native-get-random-values';
import { ready as libsodiumReady } from 'react-native-libsodium';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule } from 'expo-audio';

import { LocalAvatarProvider } from './src/context/LocalAvatarContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import GameScreen from './src/screens/GameScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PokerHubScreen from './src/screens/PokerHubScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import { MessageCircle, Layers, User, Users } from './src/icons/lucideIcons';
import { V } from './src/theme';
import GlassTabBar from './src/components/GlassTabBar';

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
const SWIPE_DISABLED_DEEPEST = new Set(['Game', 'ChatRoom']);

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
    <ChatsStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatsStack.Screen name="ChatsList" component={ChatsScreen} />
      <ChatsStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <ChatsStack.Screen name="Game" component={GameScreen} />
    </ChatsStack.Navigator>
  );
}

function ContactsStackNavigator() {
  return (
    <ContactsStack.Navigator screenOptions={{ headerShown: false }}>
      <ContactsStack.Screen name="ContactsHome" component={ContactsScreen} />
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
  const navRef = useRef(null);

  useEffect(() => {
    libsodiumReady
      .then(() => console.log('[Vault] libsodium ready'))
      .catch((e) => console.error('[Vault] libsodium init failed:', e));
  }, []);

  const swipeTabsGesture = useMemo(() => {
    const MIN_DIST = 70;
    const MIN_VELOCITY = 650;

    return Gesture.Pan()
      // Prefer internal gestures (dice throw, board interactions, chat list scroll).
      // We only claim the gesture when it's clearly horizontal.
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

  const navTree = (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navRef} theme={NavTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Login"
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: BG },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocalAvatarProvider>
          <View style={{ flex: 1, backgroundColor: BG }}>
            <PermissionBanner />
            {Platform.OS === 'android' ? (
              navTree
            ) : (
              <GestureDetector gesture={swipeTabsGesture}>{navTree}</GestureDetector>
            )}
          </View>
        </LocalAvatarProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
