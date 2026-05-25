import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import tw from 'twrnc';
import { Check } from '../../icons/lucideIcons';
import { V } from '../../theme';

/** Подтверждение с чекбоксом «удалить у всех» (очистка истории / удаление чатов из списка). */
export default function ChatClearHistoryConfirmModal({
  uiReady,
  visible,
  onClose,
  onConfirm,
  title = 'Очистить переписку?',
  description = 'Сообщения исчезнут из списка согласно выбранному варианту.',
  confirmLabel = 'Очистить',
  checkboxLabel = 'Удалить у всех' }) {
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);

  useEffect(() => {
    if (visible) setDeleteForEveryone(false);
  }, [visible]);

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
              {title}
            </Text>
            <Text style={[tw`text-[13px] mt-2`, { color: V.textSecondary, fontWeight: '400' }]}>
              {description}
            </Text>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: deleteForEveryone }}
            accessibilityLabel="Удалить у всех"
            onPress={() => setDeleteForEveryone((v) => !v)}
            style={({ pressed }) => [
              tw`flex-row items-center px-5 py-3`,
              pressed && { backgroundColor: V.hoverBg }]}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: deleteForEveryone ? V.sageSubtle : 'transparent' }}
            >
              {deleteForEveryone ? (
                <Check size={14} color={V.accentSage} strokeWidth={1.5} />
              ) : null}
            </View>
            <Text
              style={[
                tw`text-[15px] ml-3 flex-1`,
                { color: V.textPrimary, fontWeight: '400' },
                Platform.OS === 'android' ? { includeFontPadding: false } : null]}
            >
              {checkboxLabel}
            </Text>
          </Pressable>

          <View style={[tw`h-[0.5px] mx-5`, { backgroundColor: V.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={() => onConfirm(deleteForEveryone)}
            style={({ pressed }) => [
              tw`mx-3 mt-2 rounded-[10px] py-3 items-center`,
              {
                backgroundColor: V.btnPrimaryBg },
              pressed && { backgroundColor: V.btnPrimaryHover }]}
          >
            <Text style={[tw`text-[15px]`, { color: V.dangerMuted, fontWeight: '500' }]}>
              {confirmLabel}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Отмена"
            onPress={onClose}
            style={({ pressed }) => [
              tw`items-center py-3.5 mb-1 mx-3 rounded-[10px] mt-1`,
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
