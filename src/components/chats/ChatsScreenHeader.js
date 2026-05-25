import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { Search, Trash2 } from '../../icons/lucideIcons';
import { V } from '../../theme';

export default function ChatsScreenHeader({
  containerStyle,
  selectionMode,
  selectedCount,
  onExitSelection,
  onOpenDeleteConfirm,
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
      {selectionMode ? (
        <>
          <TouchableOpacity
            onPress={onExitSelection}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[tw`text-[14px]`, { color: V.accentSage }]}>Отмена</Text>
          </TouchableOpacity>
          <Text style={[tw`text-[13px] font-medium`, { color: V.textPrimary }]}>
            {selectedCount} выбрано
          </Text>
          <TouchableOpacity
            onPress={onOpenDeleteConfirm}
            disabled={selectedCount === 0}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ opacity: selectedCount === 0 ? 0.35 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Удалить выбранные чаты"
          >
            <Trash2 size={20} color={V.dangerMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
            Vault
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
        </>
      )}
    </View>
  );
}
