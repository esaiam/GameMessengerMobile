import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';

export default function ChatUploadOverlay({ visible }) {
  if (!visible) return null;
  return (
    <View
      style={[
        tw`absolute inset-0 items-center justify-center z-50`,
        { backgroundColor: 'rgba(0,0,0,0.175)' }]}
    >
      <View style={[tw`rounded-[12px] p-5 items-center`, { backgroundColor: V.bgElevated }]}>
        <ActivityIndicator size="large" color={V.accentSage} />
        <Text style={[tw`text-[10px] mt-2`, { color: V.textSecondary }]}>Отправка...</Text>
      </View>
    </View>
  );
}
