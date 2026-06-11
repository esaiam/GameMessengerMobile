import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { V } from '../../theme';
import { styles } from '../../screens/contactProfile/contactProfileScreenStyles';

export default function ContactProfileActionButton({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.actionBtn,
        { backgroundColor: V.bgElevated, borderColor: V.border },
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.actionLabel, { color: V.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
