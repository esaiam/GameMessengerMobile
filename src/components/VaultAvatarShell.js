import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V } from '../theme';
import { getInitials } from '../screens/chats/chatsFormat';
import { AvatarUnderGlassStack } from './avatarFisheyeLens';

const REF_SIZE = 52;
const REF_INITIAL_FONT = 13;
const INNER_BORDER = 1.5;
const OUTER_BORDER = 0.5;

export function vaultAvatarInitialFontSize(size) {
  return Math.max(10, Math.round((REF_INITIAL_FONT * size) / REF_SIZE));
}

/**
 * Кольцо аватара как в списках Chats / Contacts: двойная обводка, без blur/glass.
 */
export function VaultAvatarShell({ size = REF_SIZE, fill = false, children, style }) {
  const radius = size / 2;
  return (
    <View style={[styles.stack, { width: size, height: size }, style]}>
      <View
        style={[
          styles.inner,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: INNER_BORDER,
          },
          fill && styles.fill,
        ]}
      >
        <AvatarUnderGlassStack size={size}>{children}</AvatarUnderGlassStack>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.outer,
          {
            borderRadius: radius,
            borderWidth: OUTER_BORDER,
          },
        ]}
      />
    </View>
  );
}

/** Пустой аватар с инициалами — тот же визуал, что в ChatsListRow / ContactsListRow. */
export function VaultEmptyAvatar({ name, size = REF_SIZE, style }) {
  return (
    <VaultAvatarShell size={size} fill style={style}>
      <Text
        style={{
          fontSize: vaultAvatarInitialFontSize(size),
          fontWeight: '300',
          color: V.vaultAvatarInitial,
        }}
      >
        {getInitials(name)}
      </Text>
    </VaultAvatarShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
  },
  inner: {
    borderColor: V.vaultAvatarBorder,
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    backgroundColor: V.vaultAvatarFill,
  },
  outer: {
    ...StyleSheet.absoluteFillObject,
    borderColor: V.vaultAvatarBorder,
  },
});
