import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { V } from '../../theme';

/** Одно действие из меню «⋯» в шапке чата */
export default function ChatHeaderOverflowMenuModal({
  uiReady,
  visible,
  onClose,
  onClearHistory,
  onDeleteChat }) {
  const insets = useSafeAreaInsets();
  if (!uiReady) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть меню"
        style={[
          tw`flex-1 justify-start items-end px-3`,
          { backgroundColor: 'rgba(0,0,0,0.175)', paddingTop: insets.top + 10 }]}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} accessibilityRole="menu">
          <View
            style={[
              tw`rounded-[12px] overflow-hidden min-w-[200px]`,
              {
                backgroundColor: V.bgElevated,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border }]}
          >
            <Pressable
              accessibilityRole="menuitem"
              accessibilityLabel="Очистить переписку"
              onPress={() => {
                onClose();
                onClearHistory();
              }}
              style={({ pressed }) => [
                tw`px-4 py-3.5`,
                pressed && { backgroundColor: V.hoverBg }]}
            >
              <Text style={[tw`text-[15px]`, { color: V.textPrimary, fontWeight: '400' }]}>
                Очистить переписку
              </Text>
            </Pressable>

            {typeof onDeleteChat === 'function' ? (
              <>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: V.border }} />
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityLabel="Удалить чат"
                  onPress={() => {
                    onClose();
                    onDeleteChat();
                  }}
                  style={({ pressed }) => [
                    tw`px-4 py-3.5`,
                    pressed && { backgroundColor: V.hoverBg }]}
                >
                  <Text style={[tw`text-[15px]`, { color: V.dangerMuted, fontWeight: '400' }]}>
                    Удалить чат
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
