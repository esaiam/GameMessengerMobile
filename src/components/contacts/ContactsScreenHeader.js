import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { Search } from '../../icons/lucideIcons';
import { V } from '../../theme';

export default function ContactsScreenHeader({
  containerStyle,
  searchIconStyle,
  onOpenSearch,
}) {
  return (
    <View
      style={[
        containerStyle,
        {
          backgroundColor: 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      ]}
    >
      <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
        Контакты
      </Text>
      <Animated.View style={searchIconStyle}>
        <TouchableOpacity
          onPress={onOpenSearch}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Поиск"
        >
          <Search size={18} strokeWidth={1.5} color={V.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
