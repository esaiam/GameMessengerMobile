import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import GlassTabBar from '../components/GlassTabBar';
import GameScreen from '../screens/GameScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InviteFriendsScreen from '../screens/InviteFriendsScreen';
import StorageScreen from '../screens/StorageScreen';
import PokerHubScreen from '../screens/PokerHubScreen';
import ContactsScreen from '../screens/ContactsScreen';
import { Search, Layers, User, Users } from '../icons/lucideIcons';
import { V } from '../theme';

const TAB_ACTIVE = V.accentSage;
const TAB_INACTIVE = V.textMuted;

const Tabs = createBottomTabNavigator();

const ChatsStack = createNativeStackNavigator();
const ContactsStack = createNativeStackNavigator();
const PokerStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

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
      {__DEV__ && <ProfileStack.Screen name="Storage" component={StorageScreen} />}
    </ProfileStack.Navigator>
  );
}

export function MainTabs({ route }) {
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
          tabBarIcon: ({ color, size }) => (
            <Search color={color} size={size ?? 22} strokeWidth={1.5} />
          ),
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
          tabBarActiveTintColor: V.accentGold,
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
