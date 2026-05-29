import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Forward, Lock, LockOpen, Pencil, Trash2 } from '../../icons/lucideIcons';
import { V } from '../../theme';

const MENU_ICON_SIZE = 20;
const MENU_ICON_STROKE = 1.5;

function MenuRow({ icon: Icon, label, destructive, disabled, onPress }) {
  const color = destructive ? V.dangerMuted : V.textPrimary;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        disabled && styles.itemDisabled,
        pressed && !disabled && styles.itemPressed,
      ]}
    >
      <Icon size={MENU_ICON_SIZE} color={color} strokeWidth={MENU_ICON_STROKE} />
      <Text style={[styles.itemText, { color }, disabled && styles.itemTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function MenuSeparator() {
  return <View style={[styles.separator, { backgroundColor: V.border }]} />;
}

/** Меню «⋯» в шапке профиля контакта */
export default function ContactProfileOverflowMenuModal({
  visible,
  onClose,
  blocked,
  onShare,
  onBlock,
  onEdit,
  onDeleteContact,
  deleteDisabled,
}) {
  const insets = useSafeAreaInsets();
  const blockLabel = blocked ? 'Разблокировать' : 'Заблокировать';
  const BlockIcon = blocked ? LockOpen : Lock;

  const run = (fn) => () => {
    onClose();
    fn?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть меню"
        style={[styles.backdrop, { paddingTop: insets.top + 10 }]}
        onPress={onClose}
      >
        <Pressable onPress={() => {}} accessibilityRole="menu">
          <View style={styles.panel}>
            <MenuRow
              icon={Forward}
              label="Поделиться контактом"
              onPress={run(onShare)}
            />
            <MenuSeparator />
            <MenuRow icon={BlockIcon} label={blockLabel} destructive={!blocked} onPress={run(onBlock)} />
            <MenuSeparator />
            <MenuRow icon={Pencil} label="Изменить контакт" onPress={run(onEdit)} />
            <MenuSeparator />
            <MenuRow
              icon={Trash2}
              label="Удалить контакт"
              destructive
              disabled={deleteDisabled}
              onPress={() => {
                if (deleteDisabled) return;
                run(onDeleteContact)();
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.175)',
  },
  panel: {
    minWidth: 248,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemPressed: {
    backgroundColor: V.hoverBg,
  },
  itemDisabled: {
    opacity: 0.45,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  itemTextDisabled: {
    opacity: 0.7,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
});
