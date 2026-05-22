import React from 'react';
import { Pressable, Text } from 'react-native';
import { V } from '../../theme';
import { VIDEO_FEED_CIRCLE_IDLE } from './messageBubbleLayoutConstants';

export default function ChatVideoPlaceholder({ onPress }) {
  const r = VIDEO_FEED_CIRCLE_IDLE / 2;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: VIDEO_FEED_CIRCLE_IDLE,
        height: VIDEO_FEED_CIRCLE_IDLE,
        borderRadius: r,
        backgroundColor: V.bgElevated,
        alignItems: 'center',
        justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 32 }}>🎥</Text>
    </Pressable>
  );
}
