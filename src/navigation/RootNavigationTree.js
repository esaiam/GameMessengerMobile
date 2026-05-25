import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import AuthScreen from '../screens/AuthScreen';
import InviteScanScreen from '../screens/InviteScanScreen';
import PickHandleScreen from '../screens/PickHandleScreen';
import { V } from '../theme';
import { syncMainTabsFromNavState } from '../context/MainTabsNavigationContext';
import { MainTabs } from './MainTabsNavigator';
import { TabletSplitShell } from './TabletSplitShell';

const BG = V.bgApp;

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: BG,
    card: BG,
    primary: BG,
    border: BG } };

const Stack = createNativeStackNavigator();

/**
 * Корневой NavigationContainer и auth/main стек.
 */
export function RootNavigationTree({ navRef, stackKey, session, profileHandle }) {
  return (
    <TabletSplitShell>
      <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navRef}
        theme={NavTheme}
        onStateChange={syncMainTabsFromNavState}
      >
        <StatusBar style="light" />
        <Stack.Navigator
          key={stackKey}
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: BG },
            animation: 'slide_from_right' }}
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
                  contentStyle: { backgroundColor: BG } }}
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
    </TabletSplitShell>
  );
}
