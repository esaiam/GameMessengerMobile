import React from 'react';
import { View } from 'react-native';
import { Check, CheckCheck } from '../../icons/lucideIcons';
import { V } from '../../theme';

export default function ChatReadCheck({ isRead, isMine }) {
  if (!isMine) return null;
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      {isRead ? (
        <CheckCheck size={13} color={V.accentSage} strokeWidth={1.5} />
      ) : (
        <Check size={13} color={V.textMuted} strokeWidth={1.5} />
      )}
    </View>
  );
}
