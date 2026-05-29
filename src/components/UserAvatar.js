import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { VaultEmptyAvatar } from './VaultAvatarShell';

/**
 * @param {{ name: string, uri?: string | null, size?: number, onPress?: () => void, style?: object }} props
 */
export function UserAvatar({ name, uri, size = 56, onPress, style }) {
  const inner = uri ? (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
    />
  ) : (
    <VaultEmptyAvatar name={name} size={size} style={style} />
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}
