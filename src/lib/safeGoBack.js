import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { mainTabsNavigationApi } from '../context/MainTabsNavigationContext';
import { splitDetailApi } from '../context/SplitDetailContext';

const CHATS_TAB_INDEX = 0;

/**
 * Корневой список мессенджера для текущего nested-стека (Chats / Contacts).
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 */
export function getMessengerListRoute(navigation) {
  const stackNav = navigation?.getParent?.() ?? navigation;
  const routes = stackNav?.getState?.()?.routes ?? navigation?.getState?.()?.routes;
  const first = routes?.[0]?.name;
  if (first === 'ContactsHome') return 'ContactsHome';
  return 'ChatsList';
}

function getProfileStackNavigation(navigation) {
  return navigation?.getParent?.('ProfileStack') ?? null;
}

function resetProfileStackToHome(navigation) {
  const stackNav = getProfileStackNavigation(navigation);
  if (!stackNav?.dispatch) return;
  const routes = stackNav.getState?.()?.routes ?? [];
  const homeParams = routes.find((r) => r.name === 'ProfileHome')?.params;
  stackNav.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'ProfileHome', params: homeParams }],
    }),
  );
}

/**
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 * @param {() => void} [fallback]
 */
export function safeGoBack(navigation, fallback) {
  if (!navigation) return;
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  if (typeof fallback === 'function') {
    fallback();
  }
}

/** @param {import('@react-navigation/native').NavigationProp<any>} navigation */
export function safeGoBackToMessengerList(navigation) {
  safeGoBack(navigation, () => {
    const stackNav = navigation?.getParent?.() ?? navigation;
    const listRoute = getMessengerListRoute(navigation);
    const routeNames = stackNav?.getState?.()?.routes?.map((r) => r.name) ?? [];
    if (routeNames.includes(listRoute)) {
      stackNav.navigate(listRoute);
      return;
    }
    mainTabsNavigationApi.switchToTab?.(CHATS_TAB_INDEX);
  });
}

function navigateAwayFromContactProfile(navigation) {
  if (!navigation) return;

  const profileStackNav = getProfileStackNavigation(navigation);
  if (profileStackNav) {
    const routeNames = profileStackNav.getState?.()?.routes?.map((r) => r.name) ?? [];
    if (routeNames.includes('BlockedContacts')) {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
      } else {
        navigation.navigate?.('BlockedContacts');
      }
      return;
    }
    resetProfileStackToHome(navigation);
    return;
  }

  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }

  mainTabsNavigationApi.switchToTab?.(CHATS_TAB_INDEX);
}

/** @param {import('@react-navigation/native').NavigationProp<any>} navigation */
export function safeGoBackFromContactProfile(navigation) {
  safeGoBack(navigation, () => navigateAwayFromContactProfile(navigation));
}

/**
 * После блокировки / удаления переписки — уйти с ContactProfile в правильный корень стека.
 * @param {import('@react-navigation/native').NavigationProp<any>} navigation
 * @param {{ afterBlock?: boolean }} [options]
 */
export function leaveContactProfileAfterDestructiveAction(navigation, options = {}) {
  if (!navigation) return;
  if (navigation.getId?.() === 'split-detail') {
    if (options.afterBlock) {
      splitDetailApi.clearStack?.();
      mainTabsNavigationApi.resetProfileStackToHome?.();
    } else {
      navigation.goBack?.();
    }
    return;
  }
  const inProfileStack = !!getProfileStackNavigation(navigation);
  navigateAwayFromContactProfile(navigation);
  if (options.afterBlock) {
    splitDetailApi.clearStack?.();
    if (!inProfileStack) {
      mainTabsNavigationApi.resetProfileStackToHome?.();
    }
  }
}

/** Android hardware back для чата / комнаты (корень стека → список, не GO_BACK в Main). */
export function useMessengerScreenBackHandler(navigation) {
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        safeGoBackToMessengerList(navigation);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [navigation]),
  );
}

/** Android hardware back на ContactProfile. */
export function useContactProfileBackHandler(navigation) {
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        safeGoBackFromContactProfile(navigation);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [navigation]),
  );
}
