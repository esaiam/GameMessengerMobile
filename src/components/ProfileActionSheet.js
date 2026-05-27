import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ProfileGlassModal from './ProfileGlassModal';
import { profileModalBtnStyles as btn } from './profileModalButtonStyles';
import { V } from '../theme';

/**
 * Компактный лист действий / выбора для экрана Профиль.
 * options: { label, onPress?, destructive? }
 */
export default function ProfileActionSheet({
  visible,
  onClose,
  title,
  message,
  options = [],
  showCancel = true }) {
  const handleOption = async (opt) => {
    onClose();
    try {
      await opt.onPress?.();
    } catch {
      /* onPress errors handled by caller */
    }
  };

  return (
    <ProfileGlassModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={[btn.stack, styles.optionsBlock]}>
        {options.map((opt, index) => (
          <TouchableOpacity
            key={`${opt.label}-${index}`}
            style={btn.btn}
            onPress={() => handleOption(opt)}
            activeOpacity={0.7}
          >
            <Text style={[btn.btnText, opt.destructive && btn.btnTextDanger]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        {showCancel ? (
          <TouchableOpacity style={btn.btn} onPress={onClose} activeOpacity={0.7}>
            <Text style={btn.btnTextMuted}>Отмена</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ProfileGlassModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
    textAlign: 'center',
    marginBottom: 4 },
  message: {
    fontSize: 12,
    fontWeight: '400',
    color: V.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 8 },
  optionsBlock: {
    marginTop: 4 } });
