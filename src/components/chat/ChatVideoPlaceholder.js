import React from 'react';
import { Pressable, Text } from 'react-native';
import { V } from '../../theme';

export default function ChatVideoPlaceholder({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: V.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 32 }}>🎥</Text>
    </Pressable>
  );
}
