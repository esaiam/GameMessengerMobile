import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';

export default function ChatDateSeparator({ label, withTopGap }) {
  return (
    <View style={{ alignItems: 'center', marginTop: withTopGap ? 12 : 0, marginBottom: 12 }}>
      <View style={[tw`rounded-[20px] px-3 py-1`, { backgroundColor: V.bgSurface }]}>
        <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}
