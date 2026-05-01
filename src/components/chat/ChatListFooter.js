import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { Trash2 } from '../../icons/lucideIcons';
import { V } from '../../theme';

/**
 * Footer inverted FlatList: отступ под парящую шапку и/или legacy-панель мультивыбора без ChatRoomHeader.
 */
export default function ChatListFooter({
  chatRoomHeader,
  listPaddingTop,
  selectionMode,
  selectedCount,
  onExitSelection,
  onBatchDeleteForMe,
}) {
  const needsTopSpacer =
    chatRoomHeader != null && typeof listPaddingTop === 'number' && listPaddingTop > 0;
  const showLegacySelectionBar = selectionMode && chatRoomHeader == null;
  if (!needsTopSpacer && !showLegacySelectionBar) return null;

  return (
    <View collapsable={false}>
      {showLegacySelectionBar ? (
        <View
          style={[
            tw`flex-row items-center justify-between px-4 py-2.5 mb-1`,
            { backgroundColor: V.bgSurface, borderBottomWidth: 0.5, borderBottomColor: V.border },
          ]}
        >
          <TouchableOpacity onPress={onExitSelection}>
            <Text style={[tw`text-[14px]`, { color: V.accentSage }]}>Отмена</Text>
          </TouchableOpacity>
          <Text style={[tw`text-[13px] font-medium`, { color: V.textPrimary }]}>
            {selectedCount} выбрано
          </Text>
          <TouchableOpacity
            onPress={onBatchDeleteForMe}
            disabled={selectedCount === 0}
            style={{ opacity: selectedCount === 0 ? 0.35 : 1 }}
          >
            <Trash2 size={20} color={V.dangerMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      ) : null}
      {needsTopSpacer ? <View style={{ height: listPaddingTop }} collapsable={false} /> : null}
    </View>
  );
}
