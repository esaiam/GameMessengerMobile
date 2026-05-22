import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';

export default function ContactsAvatarCircle({ name }) {
  const letter = (name || '?')[0].toUpperCase();
  return (
    <View
      style={[
        tw`w-12 h-12 rounded-full items-center justify-center mr-3`,
        { backgroundColor: V.outBubbleBg },
      ]}
    >
      <Text style={[tw`text-[14px] font-medium`, { color: V.accentSage }]}>{letter}</Text>
    </View>
  );
}
