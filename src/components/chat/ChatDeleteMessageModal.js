import React, { useEffect, useState } from 'react';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { Check } from '../../icons/lucideIcons';
import { V } from '../../theme';
import ProfileGlassModal from '../ProfileGlassModal';

/** Подтверждение удаления сообщения — тот же паттерн, что ChatClearHistoryConfirmModal. */
export default function ChatDeleteMessageModal({
  uiReady,
  visible,
  onClose,
  messageId,
  onDeleteForMe,
  onDeleteForAll,
  confirmDisabled = false,
}) {
  const [deleteForEveryone, setDeleteForEveryone] = useState(false);

  useEffect(() => {
    if (visible) setDeleteForEveryone(false);
  }, [visible]);

  if (!uiReady) return null;

  const handleConfirm = async () => {
    if (messageId == null || confirmDisabled) return;
    onClose();
    if (deleteForEveryone) await onDeleteForAll(messageId);
    else await onDeleteForMe(messageId);
  };

  return (
    <ProfileGlassModal
      visible={visible}
      onClose={confirmDisabled ? () => {} : onClose}
      keyboardAvoiding={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Удалить сообщение?</Text>
        <Text style={styles.description}>
          Сообщение исчезнет из чата согласно выбранному варианту.
        </Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: deleteForEveryone }}
        accessibilityLabel="Удалить у всех"
        onPress={confirmDisabled ? undefined : () => setDeleteForEveryone((v) => !v)}
        style={({ pressed }) => [
          styles.checkboxRow,
          !confirmDisabled && pressed && { backgroundColor: V.hoverBg },
        ]}
      >
        <View
          style={[
            styles.checkboxBox,
            { backgroundColor: deleteForEveryone ? V.sageSubtle : 'transparent' },
          ]}
        >
          {deleteForEveryone ? <Check size={14} color={V.accentSage} strokeWidth={1.5} /> : null}
        </View>
        <Text
          style={[
            styles.checkboxText,
            Platform.OS === 'android' ? { includeFontPadding: false } : null,
          ]}
        >
          Удалить у всех
        </Text>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отмена"
          disabled={confirmDisabled}
          onPress={confirmDisabled ? undefined : onClose}
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionBtn,
            confirmDisabled ? styles.actionDisabled : null,
            !confirmDisabled && pressed ? styles.actionPressed : null,
          ]}
        >
          <Text style={styles.actionCancelText}>Отмена</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Удалить"
          disabled={confirmDisabled}
          onPress={confirmDisabled ? undefined : handleConfirm}
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionBtn,
            confirmDisabled ? styles.actionDisabled : null,
            !confirmDisabled && pressed ? styles.actionPressed : null,
          ]}
        >
          <Text style={styles.actionDangerText}>Удалить</Text>
        </Pressable>
      </View>
    </ProfileGlassModal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 4,
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    fontWeight: '400',
    color: V.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '400',
    color: V.textPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: V.border,
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  actionPressed: {
    backgroundColor: V.hoverBg,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionCancelText: {
    fontSize: 14,
    fontWeight: '400',
    color: V.textSecondary,
  },
  actionDangerText: {
    fontSize: 14,
    fontWeight: '400',
    color: V.dangerMuted,
  },
});
