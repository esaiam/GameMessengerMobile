import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import GlassTabBar from '../components/GlassTabBar';
import GameScreen from '../screens/GameScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BlockedContactsScreen from '../screens/BlockedContactsScreen';
import InviteFriendsScreen from '../screens/InviteFriendsScreen';
import StorageScreen from '../screens/StorageScreen';
import PokerHubScreen from '../screens/PokerHubScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ContactProfileScreen from '../screens/ContactProfileScreen';
import { Search, Layers, User, Users } from '../icons/lucideIcons';
import { V } from '../theme';
import { PagerGestureContext } from '../context/PagerGestureContext';

const ChatsStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const PokerStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TABS = [
  { key: 'Chats',    name: 'Chats',    icon: (color) => <Search color={color} size={22} strokeWidth={1.5} />, activeTint: V.accentSage },
  { key: 'Contacts', name: 'Contacts', icon: (color) => <Users  color={color} size={22} strokeWidth={1.8} />, activeTint: V.accentSage },
  { key: 'Poker',    name: 'Poker',    icon: (color) => <Layers color={color} size={22} strokeWidth={1.8} />, activeTint: V.accentGold },
  { key: 'Profile',  name: 'Profile',  icon: (color) => <User   color={color} size={22} strokeWidth={1.8} />, activeTint: V.accentSage },
];

const HIDE_TAB_BAR_ON = new Set(['ChatRoom', 'Room']);

function getDeepestRouteName(state) {
  let s = state;
  while (s && s.routes && typeof s.index === 'number') {
    const r = s.routes[s.index];
    if (!r?.state) return r?.name || null;
    s = r.state;
  }
  return null;
}

function ChatsStackNavigator({ initialParams }) {
  return (
    <ChatsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      <ChatsStack.Screen name="ChatsList" component={ChatsScreen} initialParams={initialParams} />
      <ChatsStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <ChatsStack.Screen name="Room" component={GameScreen} />
      <ChatsStack.Screen name="ContactProfile" component={ContactProfileScreen} />
    </ChatsStack.Navigator>
  );
}

function ContactsStackNavigator({ initialParams }) {
  return (
    <ContactsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      <ContactsStack.Screen name="ContactsHome" component={ContactsScreen} initialParams={initialParams} />
      <ContactsStack.Screen name="Room" component={GameScreen} />
      <ContactsStack.Screen name="ContactProfile" component={ContactProfileScreen} />
    </ContactsStack.Navigator>
  );
}

function PokerStackNavigator({ initialParams }) {
  return (
    <PokerStack.Navigator screenOptions={{ headerShown: false }}>
      <PokerStack.Screen name="PokerHub" component={PokerHubScreen} initialParams={initialParams} />
    </PokerStack.Navigator>
  );
}

function ProfileStackNavigator({ initialParams }) {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} initialParams={initialParams} />
      <ProfileStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
      <ProfileStack.Screen name="BlockedContacts" component={BlockedContactsScreen} />
      <ProfileStack.Screen name="ContactProfile" component={ContactProfileScreen} />
      {__DEV__ && <ProfileStack.Screen name="Storage" component={StorageScreen} />}
    </ProfileStack.Navigator>
  );
}

function LazyPage({ active, children }) {
  const hasBeenActive = useRef(false);
  if (active) hasBeenActive.current = true;
  if (!hasBeenActive.current) return null;
  return <View style={{ flex: 1 }}>{children}</View>;
}

export function MainTabs({ navigation, route }) {
  const pagerRef = useRef(null);
  const pagerGestureRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const nickname = route.params?.nickname;

  useEffect(() => {
    return navigation.addListener('state', () => {
      const state = navigation.getState();
      const deepest = getDeepestRouteName(state);
      setTabBarVisible(!HIDE_TAB_BAR_ON.has(deepest));
    });
  }, [navigation]);

  const handleTabPress = useCallback((index) => {
    pagerRef.current?.setPage(index);
    setActiveIndex(index);
  }, []);

  const initialParams = { nickname };

  return (
    <PagerGestureContext.Provider value={pagerGestureRef}>
      <View style={{ flex: 1, backgroundColor: V.bgApp }}>
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          offscreenPageLimit={1}
          gestureHandlerRef={pagerGestureRef}
          onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
        >
          <View key="0" style={{ flex: 1 }}>
            <LazyPage active={activeIndex === 0}>
              <ChatsStackNavigator initialParams={initialParams} />
            </LazyPage>
          </View>
          <View key="1" style={{ flex: 1 }}>
            <LazyPage active={activeIndex === 1}>
              <ContactsStackNavigator initialParams={initialParams} />
            </LazyPage>
          </View>
          <View key="2" style={{ flex: 1 }}>
            <LazyPage active={activeIndex === 2}>
              <PokerStackNavigator initialParams={initialParams} />
            </LazyPage>
          </View>
          <View key="3" style={{ flex: 1 }}>
            <LazyPage active={activeIndex === 3}>
              <ProfileStackNavigator initialParams={initialParams} />
            </LazyPage>
          </View>
        </PagerView>
        <GlassTabBar
          activeIndex={activeIndex}
          tabs={TABS}
          onTabPress={handleTabPress}
          visible={tabBarVisible}
        />
      </View>
    </PagerGestureContext.Provider>
  );
}
