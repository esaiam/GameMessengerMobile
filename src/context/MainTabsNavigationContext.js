import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CommonActions } from '@react-navigation/native';

const PROFILE_STACK_ROOT = 'ProfileHome';

/** PagerView-табы: RESET на стек не доходит — только navigate (push/pop внутри стека). */
function applyProfileStackNav(nav, screen, params) {
  if (!nav?.navigate) return false;
  if (screen === PROFILE_STACK_ROOT) {
    nav.navigate(PROFILE_STACK_ROOT, params);
    return true;
  }
  nav.navigate(screen, params);
  return true;
}

export const PROFILE_TAB_INDEX = 3;

/** Для вызовов вне React (navigateToBlockedContacts и т.п.) */
export const mainTabsNavigationApi = {
  navigateProfileStack: null,
  resetProfileStackToHome: null,
  switchToTab: null,
};

const navStateSyncRef = { current: null };

/** Вызывается из NavigationContainer.onStateChange (полный root state). */
export function syncMainTabsFromNavState(state) {
  navStateSyncRef.current?.(state);
}

const MainTabsNavigationContext = createContext(null);

/**
 * Мост между PagerView-табами и вызовами navigation.navigate('Profile', …).
 */
export function MainTabsNavigationProvider({ children }) {
  const switchToTabRef = useRef(null);
  const getActiveTabIndexRef = useRef(() => 0);
  const profileStackNavRef = useRef(null);
  const pendingProfileNavRef = useRef(null);
  const [pagerNativeScrollEnabled, setPagerNativeScrollEnabled] = useState(true);
  const pagerInteractionLockCountRef = useRef(0);
  const pagerInteractionLockedRef = useRef(false);
  const pagerLockListenerRef = useRef(null);
  const tabBarSuppressCountRef = useRef(0);
  const tabBarSuppressedRef = useRef(false);
  const tabBarSuppressListenerRef = useRef(null);

  const notifyPagerLockChanged = useCallback(() => {
    pagerLockListenerRef.current?.(pagerInteractionLockedRef.current);
  }, []);

  const notifyTabBarSuppressChanged = useCallback(() => {
    tabBarSuppressListenerRef.current?.(tabBarSuppressedRef.current);
  }, []);

  const acquirePagerInteractionLock = useCallback(() => {
    pagerInteractionLockCountRef.current += 1;
    const nextLocked = pagerInteractionLockCountRef.current > 0;
    if (nextLocked !== pagerInteractionLockedRef.current) {
      pagerInteractionLockedRef.current = nextLocked;
      notifyPagerLockChanged();
    }
  }, [notifyPagerLockChanged]);

  const releasePagerInteractionLock = useCallback(() => {
    pagerInteractionLockCountRef.current = Math.max(
      0,
      pagerInteractionLockCountRef.current - 1,
    );
    const nextLocked = pagerInteractionLockCountRef.current > 0;
    if (nextLocked !== pagerInteractionLockedRef.current) {
      pagerInteractionLockedRef.current = nextLocked;
      notifyPagerLockChanged();
    }
  }, [notifyPagerLockChanged]);

  const resetPagerInteractionLock = useCallback(() => {
    pagerInteractionLockCountRef.current = 0;
    if (pagerInteractionLockedRef.current) {
      pagerInteractionLockedRef.current = false;
      notifyPagerLockChanged();
    }
  }, [notifyPagerLockChanged]);

  const acquireTabBarSuppress = useCallback(() => {
    tabBarSuppressCountRef.current += 1;
    const next = tabBarSuppressCountRef.current > 0;
    if (next !== tabBarSuppressedRef.current) {
      tabBarSuppressedRef.current = next;
      notifyTabBarSuppressChanged();
    }
  }, [notifyTabBarSuppressChanged]);

  const releaseTabBarSuppress = useCallback(() => {
    tabBarSuppressCountRef.current = Math.max(0, tabBarSuppressCountRef.current - 1);
    const next = tabBarSuppressCountRef.current > 0;
    if (next !== tabBarSuppressedRef.current) {
      tabBarSuppressedRef.current = next;
      notifyTabBarSuppressChanged();
    }
  }, [notifyTabBarSuppressChanged]);

  const resetTabBarSuppress = useCallback(() => {
    tabBarSuppressCountRef.current = 0;
    if (tabBarSuppressedRef.current) {
      tabBarSuppressedRef.current = false;
      notifyTabBarSuppressChanged();
    }
  }, [notifyTabBarSuppressChanged]);

  const registerTabBarSuppressListener = useCallback((listener) => {
    tabBarSuppressListenerRef.current = listener ?? null;
    listener?.(tabBarSuppressedRef.current);
    return () => {
      if (tabBarSuppressListenerRef.current === listener) {
        tabBarSuppressListenerRef.current = null;
      }
    };
  }, []);

  const registerPagerInteractionLockListener = useCallback((listener) => {
    pagerLockListenerRef.current = listener ?? null;
    listener?.(pagerInteractionLockedRef.current);
    return () => {
      if (pagerLockListenerRef.current === listener) {
        pagerLockListenerRef.current = null;
      }
    };
  }, []);

  const registerMainTabsHandlers = useCallback((handlers) => {
    switchToTabRef.current = handlers?.switchToTab ?? null;
    getActiveTabIndexRef.current = handlers?.getActiveTabIndex ?? (() => 0);
    navStateSyncRef.current = handlers?.onRootNavState ?? null;
  }, []);

  const registerProfileStackNavigation = useCallback((navigation) => {
    profileStackNavRef.current = navigation;
    if (navigation && pendingProfileNavRef.current) {
      const pending = pendingProfileNavRef.current;
      pendingProfileNavRef.current = null;
      queueMicrotask(() => applyProfileStackNav(navigation, pending.screen, pending.params));
    }
  }, []);

  const switchToTab = useCallback((index) => {
    switchToTabRef.current?.(index);
  }, []);

  const getActiveTabIndex = useCallback(() => {
    return getActiveTabIndexRef.current?.() ?? 0;
  }, []);

  const navigateProfileStack = useCallback((screen, params) => {
    const nav = profileStackNavRef.current;
    if (nav) {
      return applyProfileStackNav(nav, screen, params);
    }
    pendingProfileNavRef.current = { screen, params };
    switchToTabRef.current?.(PROFILE_TAB_INDEX);
    return true;
  }, []);

  const resetProfileStackToHome = useCallback(() => {
    pendingProfileNavRef.current = null;
    const nav = profileStackNavRef.current;
    if (!nav) return false;
    const stackNav = nav.getParent?.('ProfileStack') ?? nav.getParent?.() ?? nav;
    const routes = stackNav.getState?.()?.routes ?? nav.getState?.()?.routes ?? [];
    const homeParams = routes.find((r) => r.name === PROFILE_STACK_ROOT)?.params;
    stackNav.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: PROFILE_STACK_ROOT, params: homeParams }],
      }),
    );
    return true;
  }, []);

  const value = useMemo(
    () => ({
      registerMainTabsHandlers,
      registerProfileStackNavigation,
      switchToTab,
      getActiveTabIndex,
      navigateProfileStack,
      resetProfileStackToHome,
      pagerNativeScrollEnabled,
      setPagerNativeScrollEnabled,
      acquirePagerInteractionLock,
      releasePagerInteractionLock,
      resetPagerInteractionLock,
      registerPagerInteractionLockListener,
      acquireTabBarSuppress,
      releaseTabBarSuppress,
      resetTabBarSuppress,
      registerTabBarSuppressListener,
    }),
    [
      registerMainTabsHandlers,
      registerProfileStackNavigation,
      switchToTab,
      getActiveTabIndex,
      navigateProfileStack,
      resetProfileStackToHome,
      pagerNativeScrollEnabled,
      acquirePagerInteractionLock,
      releasePagerInteractionLock,
      resetPagerInteractionLock,
      registerPagerInteractionLockListener,
      acquireTabBarSuppress,
      releaseTabBarSuppress,
      resetTabBarSuppress,
      registerTabBarSuppressListener,
    ],
  );

  mainTabsNavigationApi.navigateProfileStack = navigateProfileStack;
  mainTabsNavigationApi.resetProfileStackToHome = resetProfileStackToHome;
  mainTabsNavigationApi.switchToTab = switchToTab;

  return (
    <MainTabsNavigationContext.Provider value={value}>
      {children}
    </MainTabsNavigationContext.Provider>
  );
}

export function useMainTabsNavigation() {
  const ctx = useContext(MainTabsNavigationContext);
  if (!ctx) {
    throw new Error('useMainTabsNavigation must be used within MainTabsNavigationProvider');
  }
  return ctx;
}

export function useMainTabsNavigationOptional() {
  return useContext(MainTabsNavigationContext);
}
