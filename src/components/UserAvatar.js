import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import tw from 'twrnc';

const BG = '#1A2E2E';
const FG = '#5A9E9A';

export function getInitials(name) {
  const n = (name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '?';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}

/**
 * @param {{ name: string, uri?: string | null, size?: number, onPress?: () => void, style?: object }} props
 */
export function UserAvatar({ name, uri, size = 56, onPress, style }) {
  const fontSize = Math.max(10, Math.round(size * 0.36));

  const inner = uri ? (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
    />
  ) : (
    <View
      style={[
        tw`items-center justify-center`,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: BG },
        style,
      ]}
    >
      <Text style={{ color: FG, fontSize, fontWeight: '500' }}>{getInitials(name)}</Text>
    </View>
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
