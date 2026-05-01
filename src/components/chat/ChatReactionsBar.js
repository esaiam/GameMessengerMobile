import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';

export default function ChatReactionsBar({ reactions, onReact }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  return (
    <View style={tw`flex-row flex-wrap mt-0.5 gap-1`}>
      {Object.entries(reactions).map(([emoji, users]) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onReact(emoji)}
          style={[
            tw`flex-row items-center rounded-full px-1.5 py-0.5`,
            { backgroundColor: V.bgElevated },
          ]}
        >
          <Text style={tw`text-[10px]`}>{emoji}</Text>
          {users.length > 1 && (
            <Text style={[tw`text-[10px] ml-0.5`, { color: V.textSecondary }]}>{users.length}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
