import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { ARIA_CONTACT } from '../../lib/aria';
import { EllipsisVertical, Search, Trash2 } from '../../icons/lucideIcons';
import { CHAT_HEADER_AVATAR_SIZE, ICON_SELECTION_ACTION } from '../ChatRoomHeader';
import SafeBlurView from '../SafeBlurView';
import AiAssistantIcon from '../petrol/AiAssistantIcon';
import { PetrolShimmerText } from '../petrol/PetrolShimmer';
import { V } from '../../theme';

const CHATS_HEADER_BLUR_INTENSITY_IOS = 65;
const CHATS_HEADER_BLUR_INTENSITY_ANDROID = 42;
/** Тинт поверх blur: ~10% — свечение под шапкой читается сильнее */
const CHATS_HEADER_TINT_OPACITY = 0.1;
const ARIA_ICON_SIZE = 22;
const ARIA_ICON_TOUCH = 40;
const ARIA_SEARCH_ICON_GAP = 16;

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
  ariaGlowIntensity,
  onOpenAria,
  ariaPanelOpen = false,
  onOpenAriaOverflow,
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
      ) : ariaPanelOpen ? (
        <>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {ARIA_CONTACT.display_name}
            </Text>
            <Text style={styles.subtitle}>AI</Text>
          </View>
          <View style={styles.ariaMenuSlot}>
            <TouchableOpacity
              onPress={onOpenAriaOverflow}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Меню чата"
              style={styles.ariaMenuTouch}
            >
              <EllipsisVertical
                size={ICON_SELECTION_ACTION}
                color={V.textPrimary}
                strokeWidth={1.5}
              />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              Vault
            </Text>
            <PetrolShimmerText textStyle={styles.subtitle}>
              SECURE SPACE
            </PetrolShimmerText>
          </View>
          <View style={styles.headerTrailing}>
            <TouchableOpacity
              onPress={onOpenAria}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Aria"
              style={styles.ariaIconButton}
            >
              <View style={styles.ariaIconShell}>
                <AiAssistantIcon size={ARIA_ICON_SIZE} color={V.textMuted} />
              </View>
            </TouchableOpacity>
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
          </View>
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
    marginTop: 3,
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 0.1 * 9,
    textTransform: 'uppercase',
  },
  headerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ariaIconButton: {
    marginRight: ARIA_SEARCH_ICON_GAP,
  },
  ariaIconShell: {
    width: ARIA_ICON_TOUCH,
    height: ARIA_ICON_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Слот ⋮ как `headerRightTrailing` в ChatRoomHeader */
  ariaMenuSlot: {
    width: ICON_SELECTION_ACTION,
    height: CHAT_HEADER_AVATAR_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ariaMenuTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
