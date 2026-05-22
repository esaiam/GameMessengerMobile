import React, { useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import tw from 'twrnc';
import { V } from '../../theme';

export default function ChatDateSeparator({ label, withTopGap, onPress }) {
  const pillRef = useRef(null);

  const handlePress = () => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    pillRef.current?.measureInWindow((x, y, width, height) => {
      onPress({ x, y, width, height });
    });
  };

  return (
    <View style={{ alignItems: 'center', marginTop: withTopGap ? 12 : 0, marginBottom: 12 }}>
      <Pressable
        ref={pillRef}
        onPress={handlePress}
        disabled={!onPress}
        hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
      >
        <View style={[tw`rounded-[20px] px-3 py-1`, { backgroundColor: V.bgSurface }]}>
          <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
}
