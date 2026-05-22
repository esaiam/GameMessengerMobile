import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';
import ContactsAvatarCircle from './ContactsAvatarCircle';

export default function ContactsDrawerRow({ name, onOpen }) {
  return (
    <View
      style={[
        tw`flex-row items-center py-3 px-4`,
        { borderBottomWidth: 0.5, borderBottomColor: V.border },
      ]}
    >
      <ContactsAvatarCircle name={name} />
      <View style={tw`flex-1`}>
        <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]}>{name}</Text>
      </View>
      <TouchableOpacity
        style={[
          tw`rounded-[8px] px-3 py-1.5`,
          { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.accentSage },
        ]}
        onPress={onOpen}
      >
        <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]}>Открыть</Text>
      </TouchableOpacity>
    </View>
  );
}
