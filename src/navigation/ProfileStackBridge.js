import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { syncMainTabsFromNavState, useMainTabsNavigation } from '../context/MainTabsNavigationContext';

/**
 * Регистрирует navigation ProfileHome (push на соседние экраны стека работает отсюда).
 */

export function ProfileStackBridge() {
  const navigation = useNavigation();
  const { registerProfileStackNavigation } = useMainTabsNavigation();

  useEffect(() => {
    registerProfileStackNavigation(navigation);
    return () => registerProfileStackNavigation(null);
  }, [navigation, registerProfileStackNavigation]);

  useEffect(() => {
    const sync = () => {
      const root = navigation.getRootState?.();
      if (root) syncMainTabsFromNavState(root);
    };
    sync();
    return navigation.addListener('state', sync);
  }, [navigation]);

  return null;
}
