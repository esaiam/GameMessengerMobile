import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Pin, X } from '../../icons/lucideIcons';
import { V, TAB_BAR_LAYOUT } from '../../theme';
import { CHAT_CONTEXT_CAPSULE_H, REPLY_TARGET_PREVIEW_RADIUS } from './chatComposerConstants';
import { getMessagePreviewText } from './getMessagePreviewText';

export const CHAT_PINNED_BAR_H = CHAT_CONTEXT_CAPSULE_H;
export const CHAT_PINNED_BAR_RADIUS = REPLY_TARGET_PREVIEW_RADIUS;
/** Вертикальные отступы оболочки (парящая капсула под шапкой). */
export const CHAT_PINNED_BAR_SHELL_PAD_V = 6;

/**
 * Плашка закреплённого сообщения (парящая капсула под frosted-шапкой).
 */
export default function ChatPinnedBar({ message, onPress, onUnpin }) {
  if (!message) return null;

  const preview = getMessagePreviewText(message);
  const author = message.player_name || 'Сообщение';

  return (
    <View style={styles.shell}>
      <View style={styles.wrap}>
        <TouchableOpacity
          style={styles.body}
          activeOpacity={0.72}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Перейти к закреплённому сообщению"
        >
          <Pin size={16} color={V.accentSage} strokeWidth={1.5} style={styles.pinIcon} />
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>
              Закреплено · {author}
            </Text>
            <Text style={styles.preview} numberOfLines={1}>
              {preview}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onUnpin}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Открепить сообщение"
        >
          <X size={16} color={V.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: TAB_BAR_LAYOUT.horizontalPad,
    paddingTop: CHAT_PINNED_BAR_SHELL_PAD_V,
    paddingBottom: CHAT_PINNED_BAR_SHELL_PAD_V,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CHAT_PINNED_BAR_H,
    borderRadius: CHAT_PINNED_BAR_RADIUS,
    backgroundColor: V.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    overflow: 'hidden',
    paddingLeft: 14,
    paddingRight: 8,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  pinIcon: {
    marginRight: 10,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 2,
    borderLeftColor: V.accentSage,
    paddingLeft: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    color: V.accentSage,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  preview: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
    color: V.textSecondary,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  closeBtn: {
    width: 36,
    height: CHAT_PINNED_BAR_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
