import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import GlassTabBar from '../components/GlassTabBar';
import { useMainTabsNavigation } from '../context/MainTabsNavigationContext';
import { ProfileStackBridge } from './ProfileStackBridge';
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
import { MessageCircle, Layers, User, Users } from '../icons/lucideIcons';
import { V } from '../theme';
import { splitDetailApi } from '../context/SplitDetailContext';
import { useSplitDetail } from '../context/SplitDetailContext';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import {
  CONTACT_PROFILE_STACK_SCREEN_OPTIONS,
  getTabBarDeepestRoute,
  isPagerNativeScrollEnabled,
} from './mainTabPagerGesturePolicy';

const ChatsStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const PokerStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TABS = [
  { key: 'Chats',    name: 'Chats',    icon: (color) => <MessageCircle color={color} size={22} strokeWidth={1.5} />, activeTint: V.accentSage },
  { key: 'Contacts', name: 'Contacts', icon: (color) => <Users  color={color} size={22} strokeWidth={1.8} />, activeTint: V.accentSage },
  { key: 'Poker',    name: 'Poker',    icon: (color) => <Layers color={color} size={22} strokeWidth={1.8} />, activeTint: V.accentGold },
  { key: 'Profile',  name: 'Profile',  icon: (color) => <User   color={color} size={22} strokeWidth={1.8} />, activeTint: V.accentSage },
];

const HIDE_TAB_BAR_ON = new Set([
  'ChatRoom',
  'Room',
  'ContactProfile',
  'InviteFriends',
  'BlockedContacts',
  'Storage',
]);

/** Скрытие/показ таббара с slide — стек чатов/контактов и подэкраны профиля (200 ms, как native-stack). */
const TAB_BAR_VISIBILITY_ANIMATED_ON = new Set([
  'ChatRoom',
  'Room',
  'ContactProfile',
  'InviteFriends',
  'BlockedContacts',
  'Storage',
]);

function ChatsStackNavigator({ initialParams }) {
  return (
    <ChatsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      <ChatsStack.Screen name="ChatsList" component={ChatsScreen} initialParams={initialParams} />
      <ChatsStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <ChatsStack.Screen name="Room" component={GameScreen} />
      <ChatsStack.Screen
        name="ContactProfile"
        component={ContactProfileScreen}
        options={CONTACT_PROFILE_STACK_SCREEN_OPTIONS}
      />
    </ChatsStack.Navigator>
  );
}

function ContactsStackNavigator({ initialParams }) {
  return (
    <ContactsStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
      <ContactsStack.Screen name="ContactsHome" component={ContactsScreen} initialParams={initialParams} />
      <ContactsStack.Screen name="Room" component={GameScreen} />
      <ContactsStack.Screen
        name="ContactProfile"
        component={ContactProfileScreen}
        options={CONTACT_PROFILE_STACK_SCREEN_OPTIONS}
      />
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

function ProfileHomeRoute(props) {
  return (
    <>
      <ProfileStackBridge />
      <ProfileScreen {...props} />
    </>
  );
}

function ProfileStackNavigator({ initialParams }) {
  return (
    <ProfileStack.Navigator
      id="ProfileStack"
      detachInactiveScreens={false}
      screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}
    >
      <ProfileStack.Screen name="ProfileHome" component={ProfileHomeRoute} initialParams={initialParams} />
      <ProfileStack.Screen name="InviteFriends" component={InviteFriendsScreen} />
      <ProfileStack.Screen name="BlockedContacts" component={BlockedContactsScreen} />
      <ProfileStack.Screen
        name="ContactProfile"
        component={ContactProfileScreen}
        options={CONTACT_PROFILE_STACK_SCREEN_OPTIONS}
      />
      {__DEV__ && <ProfileStack.Screen name="Storage" component={StorageScreen} />}
    </ProfileStack.Navigator>
  );
}

export function MainTabs({ navigation, route }) {
  const pagerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [tabBarVisibilityAnimated, setTabBarVisibilityAnimated] = useState(false);
  const prevDeepestRouteRef = useRef(null);
  const isSplit = useIsSplitLayout();
  const { currentDetail } = useSplitDetail();
  const splitDetailType = isSplit ? currentDetail?.type ?? null : null;
  const nickname = route.params?.nickname;
  const {
    registerMainTabsHandlers,
    setPagerNativeScrollEnabled,
    pagerNativeScrollEnabled,
    registerPagerInteractionLockListener,
    registerTabBarSuppressListener,
    ariaTabBarHideSv,
    ariaTabBarHideRegistered,
  } = useMainTabsNavigation();

  const [pagerInteractionLocked, setPagerInteractionLocked] = useState(false);
  const [tabBarSuppressed, setTabBarSuppressed] = useState(false);
  const [tabBarSuppressAnimated, setTabBarSuppressAnimated] = useState(false);
  const tabBarSuppressedRef = useRef(false);

  useEffect(() => {
    tabBarSuppressedRef.current = tabBarSuppressed;
  }, [tabBarSuppressed]);

  useEffect(() => registerPagerInteractionLockListener(setPagerInteractionLocked), [
    registerPagerInteractionLockListener,
  ]);

  useEffect(() => {
    return registerTabBarSuppressListener((suppressed) => {
      setTabBarSuppressed(suppressed);
      setTabBarSuppressAnimated(suppressed);
    });
  }, [registerTabBarSuppressListener]);

  const handleTabBarVisibilityAnimationEnd = useCallback(({ finished, visible: isVisible }) => {
    if (!finished || !isVisible || tabBarSuppressedRef.current) {
      return;
    }
    setTabBarSuppressAnimated(false);
  }, []);

  const pagerScrollEnabled = pagerNativeScrollEnabled && !pagerInteractionLocked;

  const switchToTab = useCallback((index) => {
    pagerRef.current?.setPage(index);
    setActiveIndex(index);
    activeIndexRef.current = index;
  }, []);

  const applyRootNavState = useCallback(
    (state) => {
      if (!state) return;
      const deepest = getTabBarDeepestRoute(state, splitDetailType);
      const prevDeepest = prevDeepestRouteRef.current;
      prevDeepestRouteRef.current = deepest;
      setTabBarVisible(!HIDE_TAB_BAR_ON.has(deepest));
      setTabBarVisibilityAnimated(
        TAB_BAR_VISIBILITY_ANIMATED_ON.has(deepest)
          || TAB_BAR_VISIBILITY_ANIMATED_ON.has(prevDeepest),
      );
      setPagerNativeScrollEnabled(
        isPagerNativeScrollEnabled({ navigationState: state, splitDetailType }),
      );
    },
    [setPagerNativeScrollEnabled, splitDetailType],
  );

  useEffect(() => {
    registerMainTabsHandlers({
      switchToTab,
      getActiveTabIndex: () => activeIndexRef.current,
      onRootNavState: applyRootNavState,
    });
    return () => registerMainTabsHandlers(null);
  }, [registerMainTabsHandlers, switchToTab, applyRootNavState]);

  useEffect(() => {
    applyRootNavState(navigation.getState());
    return navigation.addListener('state', () => {
      applyRootNavState(navigation.getState());
    });
  }, [navigation, applyRootNavState]);

  useEffect(() => {
    applyRootNavState(navigation.getState());
  }, [splitDetailType, applyRootNavState, navigation]);

  const handleTabPress = useCallback((index) => {
    splitDetailApi.clearContactProfile?.();
    switchToTab(index);
  }, [switchToTab]);

  const initialParams = { nickname };
  /** Aria UI-drive только на списке чатов; на ChatRoom/Room `tabBarVisible` = false */
  const tabBarAriaPullDrive =
    activeIndex === 0 && ariaTabBarHideRegistered && tabBarVisible;

  return (
    <View style={{ flex: 1, backgroundColor: V.bgChatsScreen }}>
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          offscreenPageLimit={1}
          overdrag={false}
          overScrollMode="never"
          scrollEnabled={pagerScrollEnabled}
          onPageSelected={(e) => {
            const index = e.nativeEvent.position;
            splitDetailApi.clearContactProfile?.();
            setActiveIndex(index);
            activeIndexRef.current = index;
          }}
        >
          <View key="0" style={{ flex: 1 }}>
            {activeIndex === 0 && <ChatsStackNavigator initialParams={initialParams} />}
          </View>
          <View key="1" style={{ flex: 1 }}>
            {activeIndex === 1 && <ContactsStackNavigator initialParams={initialParams} />}
          </View>
          <View key="2" style={{ flex: 1 }}>
            {activeIndex === 2 && <PokerStackNavigator initialParams={initialParams} />}
          </View>
          <View key="3" style={{ flex: 1 }}>
            {activeIndex === 3 && <ProfileStackNavigator initialParams={initialParams} />}
          </View>
        </PagerView>
        <GlassTabBar
          activeIndex={activeIndex}
          tabs={TABS}
          onTabPress={handleTabPress}
          visible={tabBarVisible && (!tabBarSuppressed || tabBarAriaPullDrive)}
          visibilityAnimated={
            tabBarVisibilityAnimated || (tabBarSuppressAnimated && !tabBarAriaPullDrive)
          }
          ariaTabBarHideSv={tabBarAriaPullDrive ? ariaTabBarHideSv.current : null}
          onVisibilityAnimationEnd={handleTabBarVisibilityAnimationEnd}
        />
      </View>
  );
}
