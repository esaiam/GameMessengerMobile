import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
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
import { ARIA_API_URL } from '../lib/aria';
import { supabase } from '../lib/supabase';

const HEADER_BLUR_INTENSITY_IOS = 100;
const HEADER_BLUR_INTENSITY_ANDROID = 72;
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
 * @param {string} userId
 * @returns {Promise<{ mood: number; hurt: number; boredom: number; energy: number; trust: number } | null>}
 */
async function fetchAriaState(userId) {
  if (!userId || typeof userId !== 'string') return null;
  try {
    const res = await fetch(`${ARIA_API_URL}/state?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    let json = {};
    try {
      json = await res.json();
    } catch {
      return null;
    }
    const to01 = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 0;
      const x = n > 1 ? n / 100 : n;
      return Math.max(0, Math.min(1, x));
    };
    const clampBipolar = (v) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
    return {
      mood: clampBipolar(json?.mood),
      hurt: to01(json?.hurt),
      boredom: to01(json?.boredom),
      energy: to01(json?.energy),
      trust: clampBipolar(json?.trust),
    };
  } catch {
    return null;
  }
}

/**
 * Текст статуса Aria под именем (по mood из ariaState; ariaState === null → «онлайн» при доступности).
 * @param {boolean | null | undefined} ariaOnline
 * @param {{ mood?: number } | null} ariaState
 */
function getAriaHeaderStatusText(ariaOnline, ariaState) {
  if (ariaOnline === null) return null;
  if (ariaOnline !== true) return 'недоступна';
  if (ariaState == null) return 'онлайн';
  const m = ariaState.mood;
  if (typeof m !== 'number' || !Number.isFinite(m)) return 'онлайн';
  if (m > 0.3) return 'рада тебя видеть 🙂';
  if (m >= -0.3 && m <= 0.3) return 'онлайн';
  if (m >= -0.7 && m < -0.3) return 'не в настроении';
  if (m < -0.7) return 'злится';
  return 'онлайн';
}

/** Кнопка очистки истории чата Aria в слоте `headerRight` (#666 по ТЗ) */
export function AriaClearHistoryHeaderButton({ onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Очистить историю"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
    >
      <Trash2 size={ICON_SELECTION_ACTION} color="#666" strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

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
  /** Чат Aria: null | true | false — подпись под именем; если проп не передан — обычный presence по contactOnline */
  ariaOnline,
  /** Вызывается при обновлении состояния Aria из fetch (для `AriaStateGauges` снаружи) */
  onAriaStateChange,
}) {
  const insets = useSafeAreaInsets();
  const [ariaState, setAriaState] = useState(null);
  const modeAnim = useRef(new Animated.Value(selectionMode ? 1 : 0)).current;

  const isAriaHeader = typeof ariaOnline !== 'undefined';

  useEffect(() => {
    if (!isAriaHeader) return;
    let cancelled = false;
    const tick = async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id;
      if (!uid || cancelled) return;
      const next = await fetchAriaState(uid);
      if (!cancelled) setAriaState(next);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAriaHeader]);

  useEffect(() => {
    onAriaStateChange?.(ariaState);
  }, [ariaState, onAriaStateChange]);

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

  const ariaHeaderStatusText =
    hasSecondary && typeof ariaOnline !== 'undefined'
      ? getAriaHeaderStatusText(ariaOnline, ariaState)
      : null;

  const iconFlipStyle = {
    transform: [{ perspective: HEADER_ICON_PERSPECTIVE }, { rotateY: actionFlipY }],
  };

  return (
    <View collapsable={false} style={{ overflow: 'visible' }}>
      <View
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
              /* 8px от нижнего края аватарки до низа шапки (ряд по высоте AVATAR_SIZE) */
              paddingBottom: 8,
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
            marginRight: 1,
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
              {isAriaHeader ? (
                <Image
                  source={require('../../assets/images/aria_avatar.png')}
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
                  resizeMode="cover"
                  accessibilityLabel="Ария"
                />
              ) : (
                <UserAvatar name={title || 'Чат'} uri={null} size={AVATAR_SIZE} />
              )}
            </View>
            {/* Сетка: колонка справа от аватара — строка 1: имя, строка 2: статус (выровнены по левому краю колонки) */}
            <View
              style={{
                flex: 1,
                marginLeft: 8,
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
                typeof ariaOnline !== 'undefined' ? (
                  ariaHeaderStatusText === null ? null : (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: (2 * 2) / 3,
                        minWidth: 0,
                        alignSelf: 'stretch',
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: ariaOnline === true ? V.accentSage : V.textMuted,
                          marginRight: 6,
                        }}
                      />
                      <Text
                        style={[
                          {
                            flex: 1,
                            fontSize: 12,
                            fontWeight: '400',
                            lineHeight: 16,
                            color: ariaOnline === true ? V.accentSage : V.textMuted,
                          },
                          Platform.OS === 'android' ? { includeFontPadding: false } : null,
                        ]}
                        numberOfLines={ariaHeaderStatusText.length > 14 ? 2 : 1}
                      >
                        {ariaHeaderStatusText}
                      </Text>
                    </View>
                  )
                ) : (
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
                )
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
    </View>
  );
}
