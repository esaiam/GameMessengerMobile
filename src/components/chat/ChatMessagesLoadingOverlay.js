import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { V } from '../../theme';

/** Центрированный индикатор поверх области списка при первой загрузке сообщений */
export default function ChatMessagesLoadingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <ActivityIndicator size="small" color={V.accentSage} />
    </View>
  );
}
