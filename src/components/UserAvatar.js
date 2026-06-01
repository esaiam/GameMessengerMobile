import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { AvatarUnderGlassStack } from './avatarFisheyeLens';
import { VaultEmptyAvatar } from './VaultAvatarShell';

/**
 * @param {{ name: string, uri?: string | null, size?: number, onPress?: () => void, style?: object }} props
 */
export function UserAvatar({ name, uri, size = 56, onPress, style }) {
  const inner = uri ? (
    <AvatarUnderGlassStack size={size}>
      <Image
        key={uri}
        source={{ uri }}
        style={[{ width: size, height: size }, style]}
        resizeMode="cover"
      />
    </AvatarUnderGlassStack>
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
