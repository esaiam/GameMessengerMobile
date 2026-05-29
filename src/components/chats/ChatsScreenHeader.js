import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { Search, Trash2 } from '../../icons/lucideIcons';
import SafeBlurView from '../SafeBlurView';
import { V } from '../../theme';

const CHATS_HEADER_BLUR_INTENSITY_IOS = 100;
const CHATS_HEADER_BLUR_INTENSITY_ANDROID = 60;
/** Тинт поверх blur: ~10% — свечение под шапкой читается сильнее */
const CHATS_HEADER_TINT_OPACITY = 0.1;

function headerBackdropStyle(blurExtendTop) {
  if (!blurExtendTop) {
    return StyleSheet.absoluteFillObject;
  }
  return {
    position: 'absolute',
    top: -blurExtendTop,
    left: 0,
    right: 0,
    bottom: 0,
  };
}

export default function ChatsScreenHeader({
  blurExtendTop = 0,
  containerStyle,
  selectionMode,
  selectedCount,
  onExitSelection,
  onOpenDeleteConfirm,
  searchIconStyle,
  onOpenSearch,
}) {
  const backdropStyle = headerBackdropStyle(blurExtendTop);

  return (
    <View
      style={[
        containerStyle,
        styles.headerRoot,
        blurExtendTop > 0 ? { marginTop: blurExtendTop } : null,
      ]}
    >
      <SafeBlurView
        intensity={
          Platform.OS === 'ios'
            ? CHATS_HEADER_BLUR_INTENSITY_IOS
            : CHATS_HEADER_BLUR_INTENSITY_ANDROID
        }
        tint="dark"
        blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
        style={backdropStyle}
      />
      <View
        pointerEvents="none"
        style={[
          backdropStyle,
          { backgroundColor: V.bgChatsScreen, opacity: CHATS_HEADER_TINT_OPACITY },
        ]}
      />
      {selectionMode ? (
        <>
          <TouchableOpacity
            onPress={onExitSelection}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[tw`text-[14px]`, { color: V.accentSage }]}>Отмена</Text>
          </TouchableOpacity>
          <Text style={[tw`text-[13px] font-medium`, { color: V.textPrimary }]}>
            {selectedCount} выбрано
          </Text>
          <TouchableOpacity
            onPress={onOpenDeleteConfirm}
            disabled={selectedCount === 0}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ opacity: selectedCount === 0 ? 0.35 : 1 }}
            accessibilityRole="button"
            accessibilityLabel="Удалить выбранные чаты"
          >
            <Trash2 size={20} color={V.dangerMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              Vault
            </Text>
            <Text style={styles.subtitle}>SECURE SPACE</Text>
          </View>
          <Animated.View style={searchIconStyle}>
            <TouchableOpacity
              onPress={onOpenSearch}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Поиск"
            >
              <Search size={18} strokeWidth={1.5} color={V.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRoot: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    overflow: 'visible',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '300',
    letterSpacing: 0.06 * 17,
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 0.12 * 9,
    color: V.accentSage,
    opacity: 0.6,
  },
});
