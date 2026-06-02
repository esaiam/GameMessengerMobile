import React, { useMemo, useRef } from 'react';
import { Animated as RNAnimated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { Search, Sparkles, Trash2 } from '../../icons/lucideIcons';
import SafeBlurView from '../SafeBlurView';
import { V } from '../../theme';

const CHATS_HEADER_BLUR_INTENSITY_IOS = 65;
const CHATS_HEADER_BLUR_INTENSITY_ANDROID = 42;
/** Тинт поверх blur: ~10% — свечение под шапкой читается сильнее */
const CHATS_HEADER_TINT_OPACITY = 0.1;
const ARIA_ICON_SIZE = 18;
const ARIA_GLOW_CIRCLE_SIZE = 32;
const ARIA_SEARCH_ICON_GAP = 16;
const ARIA_GLOW_SAGE = 'rgba(90,158,154,1)';
const ARIA_GLOW_CIRCLE_BG = 'rgba(90,158,154,0.15)';

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
}) {
  const defaultAriaGlowIntensity = useRef(new RNAnimated.Value(0)).current;
  const glowIntensity = ariaGlowIntensity ?? defaultAriaGlowIntensity;
  const AnimatedSparkles = useMemo(
    () => RNAnimated.createAnimatedComponent(Sparkles),
    [],
  );
  const ariaIconColor = glowIntensity.interpolate({
    inputRange: [0, 1],
    outputRange: [V.textMuted, ARIA_GLOW_SAGE],
  });
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
          <View style={styles.headerTrailing}>
            <TouchableOpacity
              onPress={onOpenAria}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Aria"
              style={styles.ariaIconButton}
            >
              <View style={styles.ariaIconShell}>
                <RNAnimated.View
                  pointerEvents="none"
                  style={[
                    styles.ariaGlowCircle,
                    { opacity: glowIntensity },
                  ]}
                />
                <RNAnimated.View style={styles.ariaIconWrap}>
                  <AnimatedSparkles
                    size={ARIA_ICON_SIZE}
                    strokeWidth={1.5}
                    color={ariaIconColor}
                  />
                </RNAnimated.View>
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
    marginTop: 2,
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 0.12 * 9,
    color: V.accentSage,
    opacity: 0.6,
  },
  headerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ariaIconButton: {
    marginRight: ARIA_SEARCH_ICON_GAP,
  },
  ariaIconShell: {
    width: ARIA_GLOW_CIRCLE_SIZE,
    height: ARIA_GLOW_CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ariaGlowCircle: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ARIA_GLOW_CIRCLE_BG,
    borderRadius: ARIA_GLOW_CIRCLE_SIZE / 2,
  },
  ariaIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
