import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  StyleSheet,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import SafeBlurView from './SafeBlurView';
import { UserAvatar } from './UserAvatar';
import { ArrowLeft, X, Copy, Forward, Trash2 } from '../icons/lucideIcons';
import { V } from '../theme';

const HEADER_BLUR_INTENSITY_IOS = 78;
const HEADER_BLUR_INTENSITY_ANDROID = 56;
const HEADER_FROST_TINT_OPACITY = 0.28;
const AVATAR_SIZE = 42;
/** Левая зона (назад / крестик) и действия выделения — один визуальный размер */
/** Экспорт для слотов вне шапки (напр. `headerRight` в GameScreen) — тот же размер, что у действий шапки */
export const ICON_SELECTION_ACTION = 26;
/** Счётчик выделенных — кегль в пару с ICON_SELECTION_ACTION */
const SELECTION_COUNT_FONT = 18;
const SELECTION_COUNT_LINE_HEIGHT = 26;
const SELECTION_ACTION_GAP = 12;
const MODE_ANIM_MS = 320;
/** Для rotateY у иконок действий и морфа трубка ↔ корзина */
const HEADER_ICON_PERSPECTIVE = 480;

/**
 * Frosted шапка экрана чата: обычный режим (назад + аватар + статус) и режим выделения
 * (стрелка → крестик, счётчик, копировать / переслать / удалить).
 */
export default function ChatRoomHeader({
  title,
  contactOnline,
  navigation,
  selectionMode,
  selectedCount,
  onExitSelection,
  onCopy,
  onForward,
  onDelete,
  /** Опциональный слот справа (обычный режим), напр. звонок в Game — в выделении морфится в «Удалить» */
  headerRight,
  /** Если задан — заменяет insets.top + 8 (напр. шапка под уже учтённым safe area + полосой статуса на планшете) */
  topPaddingOverride,
}) {
  const insets = useSafeAreaInsets();
  const modeAnim = useRef(new Animated.Value(selectionMode ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: selectionMode ? 1 : 0,
      duration: MODE_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectionMode, modeAnim]);

  const arrowOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const xOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  /** Поворот по часовой стрелке (rotateZ): стрелка уходит 0°→90°, крестик входит −90°→0° */
  const arrowRotateZ = modeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const xRotateZ = modeAnim.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });

  const normalBlockOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const selectionBlockOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  /** Флип вокруг вертикальной оси: к выделению 90°→0°, обратно симметрично */
  const actionFlipY = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  const phoneOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const phoneRotateY = modeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });
  const trashSlotOpacity = modeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const trashMorphRotateY = modeAnim.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });

  const onLeftPress = () => {
    if (selectionMode) onExitSelection();
    else navigation.goBack();
  };

  const hasSecondary = title && title !== 'Чат';
  const actionsDisabled = selectedCount === 0;
  const morphTrashWithHeaderRight = !!headerRight;

  const iconFlipStyle = {
    transform: [{ perspective: HEADER_ICON_PERSPECTIVE }, { rotateY: actionFlipY }],
  };

  return (
    <View
      collapsable={false}
      style={{
        overflow: 'visible',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: V.border,
      }}
    >
      <SafeBlurView
        intensity={Platform.OS === 'ios' ? HEADER_BLUR_INTENSITY_IOS : HEADER_BLUR_INTENSITY_ANDROID}
        tint="dark"
        blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: V.bgElevated,
            opacity: HEADER_FROST_TINT_OPACITY,
          },
        ]}
      />
      <View
        style={[
          tw`flex-row px-4`,
          {
            paddingTop: typeof topPaddingOverride === 'number' ? topPaddingOverride : insets.top + 10,
            /* +1 к прежним 2 — плотнее к полосе статуса / зоне ползунка под шапкой (GameScreen) */
            paddingBottom: 3,
            /* flex-start: слот справа и блок аватар+текст начинаются сверху — трубка в линию с аватаром */
            alignItems: 'flex-start',
            overflow: 'visible',
          },
        ]}
      >
        <TouchableOpacity
          onPress={onLeftPress}
          accessibilityRole="button"
          accessibilityLabel={selectionMode ? 'Отменить выделение' : 'Назад'}
          style={{
            width: 40,
            alignSelf: 'stretch',
            minHeight: AVATAR_SIZE,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: -10,
            marginRight: 2,
          }}
        >
          <View
            style={{
              width: ICON_SELECTION_ACTION + 8,
              height: ICON_SELECTION_ACTION + 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                opacity: arrowOpacity,
                transform: [{ rotateZ: arrowRotateZ }],
              }}
            >
              <ArrowLeft size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: xOpacity,
                transform: [{ rotateZ: xRotateZ }],
              }}
            >
              <X size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
            </Animated.View>
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, minHeight: AVATAR_SIZE, position: 'relative' }}>
          <Animated.View
            style={{
              opacity: normalBlockOpacity,
              flexDirection: 'row',
              alignItems: 'flex-start',
              pointerEvents: selectionMode ? 'none' : 'auto',
            }}
          >
            <View style={{ marginLeft: 8 }}>
              <UserAvatar name={title || 'Чат'} uri={null} size={AVATAR_SIZE} />
            </View>
            {/* Сетка: колонка справа от аватара — строка 1: имя, строка 2: статус (выровнены по левому краю колонки) */}
            <View
              style={{
                flex: 1,
                marginLeft: 12,
                minWidth: 0,
                justifyContent: 'flex-start',
              }}
            >
              <Text
                style={[
                  {
                    fontSize: 16,
                    fontWeight: '500',
                    /* было 22; −⅓ «лишка» над кеглем (22−16)/3 ≈ 2 → 20 — плотнее к статусу */
                    lineHeight: 20,
                    color: V.textPrimary,
                  },
                  Platform.OS === 'android' ? { includeFontPadding: false } : null,
                ]}
                numberOfLines={1}
              >
                {title || 'Чат'}
              </Text>
              {hasSecondary ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    /* было 2; на треть меньше → 2×⅔ */
                    marginTop: (2 * 2) / 3,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: contactOnline ? V.accentSage : V.textMuted,
                      marginRight: 6,
                    }}
                  />
                  <Text
                    style={[
                      {
                        fontSize: 12,
                        fontWeight: '400',
                        lineHeight: 16,
                        color: contactOnline ? V.accentSage : V.textMuted,
                      },
                      Platform.OS === 'android' ? { includeFontPadding: false } : null,
                    ]}
                  >
                    {contactOnline ? 'в сети' : 'не в сети'}
                  </Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: selectionBlockOpacity,
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              flexDirection: 'row',
              alignItems: 'center',
              pointerEvents: selectionMode ? 'auto' : 'none',
            }}
          >
            <Text
              style={[
                tw`font-medium`,
                {
                  color: V.textPrimary,
                  marginLeft: 4,
                  minWidth: 24,
                  fontSize: SELECTION_COUNT_FONT,
                  lineHeight: SELECTION_COUNT_LINE_HEIGHT,
                },
                Platform.OS === 'android' ? { includeFontPadding: false } : null,
              ]}
            >
              {selectedCount}
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={onCopy}
              disabled={actionsDisabled}
              accessibilityLabel="Скопировать"
              style={{ paddingVertical: 6, paddingHorizontal: 8, opacity: actionsDisabled ? 0.35 : 1 }}
            >
              <Animated.View style={iconFlipStyle}>
                <Copy size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onForward}
              disabled={actionsDisabled}
              accessibilityLabel="Переслать"
              style={{
                paddingVertical: 6,
                paddingHorizontal: 8,
                marginLeft: SELECTION_ACTION_GAP,
                opacity: actionsDisabled ? 0.35 : 1,
              }}
            >
              <Animated.View style={iconFlipStyle}>
                <Forward size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
              </Animated.View>
            </TouchableOpacity>
            {!morphTrashWithHeaderRight ? (
              <TouchableOpacity
                onPress={onDelete}
                disabled={actionsDisabled}
                accessibilityLabel="Удалить"
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  marginLeft: SELECTION_ACTION_GAP,
                  opacity: actionsDisabled ? 0.35 : 1,
                }}
              >
                <Animated.View style={iconFlipStyle}>
                  <Trash2 size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
                </Animated.View>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        </View>
        {headerRight ? (
          <View
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              marginLeft: 4,
              alignSelf: 'flex-start',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'visible',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: phoneOpacity,
                transform: [{ perspective: HEADER_ICON_PERSPECTIVE }, { rotateY: phoneRotateY }],
                pointerEvents: selectionMode ? 'none' : 'auto',
              }}
            >
              {headerRight}
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: trashSlotOpacity,
                transform: [{ perspective: HEADER_ICON_PERSPECTIVE }, { rotateY: trashMorphRotateY }],
                pointerEvents: selectionMode ? 'auto' : 'none',
              }}
            >
              <TouchableOpacity
                onPress={onDelete}
                disabled={actionsDisabled || !selectionMode}
                accessibilityLabel="Удалить"
                style={{
                  width: '100%',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: actionsDisabled ? 0.35 : 1,
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
