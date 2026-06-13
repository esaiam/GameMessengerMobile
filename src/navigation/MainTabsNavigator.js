import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
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
import ContactsScreen from '../screens/ContactsScreen';
import ContactProfileScreen from '../screens/ContactProfileScreen';
import { MessageCircle, User, Users } from '../icons/lucideIcons';
import { V, TAB_BAR_LAYOUT } from '../theme';
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
const ProfileStack = createNativeStackNavigator();
const TopTab = createMaterialTopTabNavigator();

const TAB_ROUTE_NAMES = ['Chats', 'Contacts', 'Profile'];

const TAB_ICON_SIZE = TAB_BAR_LAYOUT.tabIconSize;

/** Пробрасывает `position` pager-а в GlassTabBar (Animated interpolation 0…n-1). */
function PagerPositionBridge({ position, onPosition }) {
  useLayoutEffect(() => {
    onPosition(position);
  }, [position, onPosition]);
  return null;
}

const TABS = [
  { key: 'Chats',    name: 'Chats',    icon: (color) => <MessageCircle color={color} size={TAB_ICON_SIZE} strokeWidth={1.5} />, activeTint: V.accentSage },
  { key: 'Contacts', name: 'Contacts', icon: (color) => <Users  color={color} size={TAB_ICON_SIZE} strokeWidth={1.8} />, activeTint: V.accentSage },
  { key: 'Profile',  name: 'Profile',  icon: (color) => <User   color={color} size={TAB_ICON_SIZE} strokeWidth={1.8} />, activeTint: V.accentSage },
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
    <ChatsStack.Navigator
      id="ChatsStack"
      screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}
    >
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
    <ContactsStack.Navigator
      id="ContactsStack"
      screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}
    >
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
  const topTabNavRef = useRef(null);
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
  const [pagerPosition, setPagerPosition] = useState(null);
  const tabBarSuppressedRef = useRef(false);

  const handlePagerPosition = useCallback((position) => {
    setPagerPosition((prev) => (prev === position ? prev : position));
  }, []);

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

  const tabSwipeEnabled = pagerNativeScrollEnabled && !pagerInteractionLocked;

  const switchToTab = useCallback((index) => {
    const routeName = TAB_ROUTE_NAMES[index];
    if (routeName) {
      topTabNavRef.current?.navigate(routeName);
    }
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

  const handleTopTabState = useCallback((e) => {
    const idx = e.data.state.index;
    if (idx !== activeIndexRef.current) {
      splitDetailApi.clearContactProfile?.();
    }
    activeIndexRef.current = idx;
    setActiveIndex(idx);
  }, []);

  const initialParams = { nickname };
  /** Aria UI-drive только на списке чатов; на ChatRoom/Room `tabBarVisible` = false */
  const tabBarAriaPullDrive =
    activeIndex === 0 && ariaTabBarHideRegistered && tabBarVisible;

  return (
    <View style={{ flex: 1, backgroundColor: V.bgChatsScreen }}>
      <TopTab.Navigator
        initialRouteName="Chats"
        tabBar={(props) => {
          topTabNavRef.current = props.navigation;
          return (
            <PagerPositionBridge
              position={props.position}
              onPosition={handlePagerPosition}
            />
          );
        }}
        screenListeners={{
          state: handleTopTabState,
        }}
        screenOptions={{
          swipeEnabled: tabSwipeEnabled,
          lazy: false,
          sceneStyle: { backgroundColor: V.bgChatsScreen },
        }}
      >
        <TopTab.Screen name="Chats">
          {() => <ChatsStackNavigator initialParams={initialParams} />}
        </TopTab.Screen>
        <TopTab.Screen name="Contacts">
          {() => <ContactsStackNavigator initialParams={initialParams} />}
        </TopTab.Screen>
        <TopTab.Screen name="Profile">
          {() => <ProfileStackNavigator initialParams={initialParams} />}
        </TopTab.Screen>
      </TopTab.Navigator>
      <GlassTabBar
        activeIndex={activeIndex}
        pagerPosition={pagerPosition}
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
