import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { V } from '../../theme';

/** Локальное переименование контакта (отображаемое имя только у вас). */
export default function ContactProfileEditContactModal({
  visible,
  initialName,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(initialName || '');

  useEffect(() => {
    if (visible) setDraft(initialName || '');
  }, [visible, initialName]);

  const handleSave = () => {
    onSave(draft.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть">
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={[styles.title, { color: V.textPrimary }]}>Изменить контакт</Text>
            <Text style={[styles.hint, { color: V.textSecondary }]}>Имя видно только вам</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Имя"
              placeholderTextColor={V.textMuted}
              autoFocus
              maxLength={64}
              style={[
                styles.input,
                {
                  color: V.textPrimary,
                  backgroundColor: V.bgSurface,
                  borderColor: V.border,
                },
              ]}
            />
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: V.textSecondary }]}>Отмена</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: V.accentSage }]}>Сохранить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 14,
  },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
