import React from 'react';
import { View } from 'react-native';
import { Check, CheckCheck } from '../../icons/lucideIcons';
import { V } from '../../theme';

export default function ChatReadCheck({ isRead, isMine, variant = 'default' }) {
  if (!isMine) return null;
  const onOverlay = variant === 'overlay';
  const readColor = V.accentSage;
  const sentColor = onOverlay ? 'rgba(255, 255, 255, 0.72)' : V.textMuted;
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      {isRead ? (
        <CheckCheck size={13} color={readColor} strokeWidth={1.5} />
      ) : (
        <Check size={13} color={sentColor} strokeWidth={1.5} />
      )}
    </View>
  );
}
