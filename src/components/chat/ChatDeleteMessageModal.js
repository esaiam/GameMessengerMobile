import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import tw from 'twrnc';
import { Check, Users } from 'lucide-react-native';
import { V } from '../../theme';

/** Подтверждение удаления: для себя / для всех */
export default function ChatDeleteMessageModal({
  uiReady,
  visible,
  onClose,
  messageId,
  onDeleteForMe,
  onDeleteForAll }) {
  if (!uiReady) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть"
        style={[tw`flex-1 justify-center items-center px-6`, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={[
            tw`w-full max-w-sm rounded-[12px] overflow-hidden`,
            {
              backgroundColor: V.bgElevated,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: V.border }]}
        >
          <View style={tw`px-5 pt-5 pb-2`}>
            <Text style={[tw`text-[16px]`, { color: V.textPrimary, fontWeight: '500' }]}>
              Удалить сообщение?
            </Text>
            <Text style={[tw`text-[13px] mt-2`, { color: V.textSecondary, fontWeight: '400' }]}>
              Выберите, для кого удалить сообщение.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Удалить только у себя"
            onPress={async () => {
              if (messageId == null) return;
              onClose();
              await onDeleteForMe(messageId);
            }}
            style={({ pressed }) => [
              tw`flex-row items-center px-5 py-3.5`,
              pressed && { backgroundColor: V.hoverBg }]}
          >
            <Check size={20} color={V.accentSage} strokeWidth={1.5} />
            <Text style={[tw`text-[15px] ml-3 flex-1`, { color: V.textPrimary, fontWeight: '400' }]}>
              Только у меня
            </Text>
          </Pressable>
          <View style={[tw`h-[0.5px] mx-5`, { backgroundColor: V.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Удалить у всех в чате"
            onPress={async () => {
              if (messageId == null) return;
              onClose();
              await onDeleteForAll(messageId);
            }}
            style={({ pressed }) => [
              tw`flex-row items-center px-5 py-3.5`,
              pressed && { backgroundColor: V.hoverBg }]}
          >
            <Users size={20} color="#E05A5A" strokeWidth={1.5} />
            <Text style={[tw`text-[15px] ml-3 flex-1`, { color: '#E05A5A', fontWeight: '400' }]}>
              Удалить у собеседника тоже
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Отмена"
            onPress={onClose}
            style={({ pressed }) => [
              tw`items-center py-3.5 mb-1 mx-3 rounded-[10px]`,
              pressed && { backgroundColor: V.hoverBg }]}
          >
            <Text style={[tw`text-[15px]`, { color: V.textSecondary, fontWeight: '400' }]}>
              Отмена
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
