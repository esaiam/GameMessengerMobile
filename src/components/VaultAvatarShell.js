import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V } from '../theme';
import { getInitials } from '../screens/chats/chatsFormat';
import { AvatarUnderGlassStack } from './avatarFisheyeLens';

const REF_SIZE = 52;
const REF_INITIAL_FONT = 13;

export function vaultAvatarInitialFontSize(size) {
  return Math.max(10, Math.round((REF_INITIAL_FONT * size) / REF_SIZE));
}

/** Круглый аватар как в списках Chats / Contacts. */
export function VaultAvatarShell({ size = REF_SIZE, fill = false, children, style }) {
  const radius = size / 2;
  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        fill && styles.fill,
        style,
      ]}
    >
      <AvatarUnderGlassStack size={size}>{children}</AvatarUnderGlassStack>
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
  shell: {
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    backgroundColor: V.vaultAvatarFill,
  },
});
