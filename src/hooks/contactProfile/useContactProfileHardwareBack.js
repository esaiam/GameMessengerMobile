import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { safeGoBackFromContactProfile } from '../../lib/safeGoBack';

/**
 * Android hardware back: viewer close → exit selection → navigate back.
 */
export function useContactProfileHardwareBack({
  navigation,
  viewerVisible,
  mediaViewerRef,
  mediaSelectionMode,
  exitMediaSelection,
}) {
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (viewerVisible) {
          mediaViewerRef.current?.close();
          return true;
        }
        if (mediaSelectionMode) {
          exitMediaSelection();
          return true;
        }
        safeGoBackFromContactProfile(navigation);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [navigation, viewerVisible, mediaSelectionMode, exitMediaSelection, mediaViewerRef]),
  );
}
