import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export const PROFILE_STACK_ID = 'ProfileStack';

/** @param {import('@react-navigation/native').NavigationProp<any>} navigation */
export function profileStackGoBack(navigation) {
  if (!navigation) return;
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigation.navigate?.('ProfileHome');
}

/** Кнопка «Назад» в UI + hardware back (Android). */
export function useProfileStackBackHandler(navigation) {
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        profileStackGoBack(navigation);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [navigation]),
  );
}
