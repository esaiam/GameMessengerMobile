import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';

export default function ChatReplyPreview({ replyMsg }) {
  if (!replyMsg) return null;
  return (
    <View
      style={[
        tw`rounded-[8px] px-2.5 py-1.5 mb-1`,
        {
          backgroundColor: 'rgba(37,42,53,0.5)',
          borderLeftWidth: 2,
          borderLeftColor: V.accentSage,
        },
      ]}
    >
      <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]} numberOfLines={1}>
        {replyMsg.player_name}
      </Text>
      <Text style={[tw`text-[10px]`, { color: V.textSecondary }]} numberOfLines={1}>
        {replyMsg.text}
      </Text>
    </View>
  );
}
