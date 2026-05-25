import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useMainTabsNavigation } from '../context/MainTabsNavigationContext';

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

  return null;
}
