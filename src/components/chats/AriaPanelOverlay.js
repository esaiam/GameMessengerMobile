import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Mic, Send } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { sendAriaChatTextMessage } from '../chat/ariaTextComposerSend';
import AriaPanelDismissHandle from './AriaPanelDismissHandle';
import AriaPanelMessageList from './AriaPanelMessageList';

const ARIA_PANEL_STARS = require('../../../assets/images/aria_panel_stars.jpg');

const INPUT_PANEL_H = 100;
const INPUT_BOTTOM = 8;
const INPUT_HORIZONTAL = 14;
/** Полоса-подсказка закрытия под полем ввода */
const DISMISS_HANDLE_H = 36;
const CONTENT_BOTTOM_RESERVE = INPUT_PANEL_H + INPUT_BOTTOM + DISMISS_HANDLE_H;
const INPUT_TEXT_H = 52;
const CONTENT_FADE_MS = 250;
const INPUT_EXPAND_MS = 420;
const COMMIT_SPRING = { damping: 22, stiffness: 240, mass: 0.85 };
const INPUT_EXPAND_EASING = Easing.out(Easing.cubic);
/** Окно ввода — когда шторка почти у низа; узкий диапазон для drag, плавный ramp */
const INPUT_REVEAL_FROM = 0.996;

const CURTAIN_BG = V.bgChatsScreen;
/** Затемнение звёзд: верх чуть светлее, низ в цвет экрана чатов. */
const STARS_GRADIENT_TOP = 'rgba(8,12,20,0.08)';
const STARS_SCRIM_OPACITY = 0.42;
const PANEL_BG = V.bgSurface;
const PANEL_BORDER = 'rgba(255,255,255,0.1)';
const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.25)';
/** keyboardHeightLib < -threshold → KB open (same sign as chat composer). */
const KB_OPEN_THRESHOLD_PX = 50;

/**
 * Сдвиг ленты/ввода с KB. Handle-blend плавный (без скачка на пороге при опускании).
 */
function computeAriaPanelKbLift(keyboardHeightLib) {
  'worklet';
  const handleBlend = interpolate(
    keyboardHeightLib,
    [0, -KB_OPEN_THRESHOLD_PX],
    [0, 1],
    Extrapolation.CLAMP,
  );
  return keyboardHeightLib + handleBlend * DISMISS_HANDLE_H;
}

function CurtainNoise() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="ariaCurtainNoise" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <Rect x="0" y="0" width="2" height="2" fill="rgba(255,255,255,0.10)" />
            <Rect x="3" y="1" width="1" height="1" fill="rgba(255,255,255,0.08)" />
            <Rect x="1" y="4" width="1" height="1" fill="rgba(0,0,0,0.10)" />
            <Rect x="4" y="4" width="2" height="2" fill="rgba(0,0,0,0.08)" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ariaCurtainNoise)" opacity={0.18} />
      </Svg>
    </View>
  );
}

function computeInputReveal(progress, inputExpand, committed) {
  'worklet';
  if (progress < INPUT_REVEAL_FROM) {
    return 0;
  }
  if (committed) {
    return inputExpand;
  }
  return interpolate(
    progress,
    [INPUT_REVEAL_FROM, 1],
    [0, 1],
    Extrapolation.CLAMP,
  );
}

/** Opacity звёзд только от pullProgress — без сброса на inputExpand при commit (иначе мигание). */
function computeStarsOpacity(progress) {
  'worklet';
  return interpolate(progress, [0.12, 0.82], [0, 1], Extrapolation.CLAMP);
}

function AriaPanelStarsBackdrop() {
  return (
    <View style={styles.backdropLayers} pointerEvents="none" collapsable={false}>
      <Image source={ARIA_PANEL_STARS} style={styles.backdropImage} resizeMode="cover" />
      <LinearGradient
        colors={[STARS_GRADIENT_TOP, CURTAIN_BG]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[StyleSheet.absoluteFillObject, styles.backdropScrim]}
        pointerEvents="none"
      />
    </View>
  );
}

export default function AriaPanelOverlay({
  pullProgress,
  committedSv,
  committed,
  onClose,
  headerMinHeight,
  ariaMessages = [],
  ariaDisplayNickname = '',
  sendToAria,
  ariaOnline = null,
}) {
  const { height: screenHeight } = useWindowDimensions();
  const curtainMaxHeight = Math.max(0, screenHeight - headerMinHeight);
  const curtainMaxHeightSv = useSharedValue(curtainMaxHeight);

  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const wasCommittedRef = useRef(false);
  const sendInProgressRef = useRef(false);

  const inputExpand = useSharedValue(0);
  const { height: keyboardHeightLib } = useReanimatedKeyboardAnimation();

  useEffect(() => {
    curtainMaxHeightSv.value = curtainMaxHeight;
  }, [curtainMaxHeight, curtainMaxHeightSv]);

  const requestClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const dismissKeyboard = useCallback(() => {
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const canSendDraft = draft.trim().length > 0 && ariaOnline !== false;

  const handleSendPress = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || !sendToAria || ariaOnline === false) {
      return;
    }
    await sendAriaChatTextMessage({
      trimmed,
      sendToAria,
      sendInProgressRef,
      setText: setDraft,
      setReplyTarget: () => {},
    });
  }, [draft, sendToAria, ariaOnline]);

  useEffect(() => {
    if (committed) {
      setDraft('');
      wasCommittedRef.current = true;
      return;
    }
    if (wasCommittedRef.current) {
      wasCommittedRef.current = false;
      inputExpand.value = withTiming(0, {
        duration: CONTENT_FADE_MS,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [committed, inputExpand]);

  useAnimatedReaction(
    () => ({
      progress: pullProgress.value,
      committed: committedSv.value > 0.5,
    }),
    (cur, prev) => {
      if (!cur.committed) {
        if (prev?.committed) {
          inputExpand.value = 0;
        }
        return;
      }
      const atBottom = cur.progress >= INPUT_REVEAL_FROM;
      if (!atBottom) {
        return;
      }
      const justCommitted = prev == null || !prev.committed;
      const justReachedBottom = prev == null || prev.progress < INPUT_REVEAL_FROM;
      if (justCommitted || justReachedBottom) {
        inputExpand.value = withTiming(1, {
          duration: INPUT_EXPAND_MS,
          easing: INPUT_EXPAND_EASING,
        });
      }
    },
    [committedSv],
  );

  const dismissKeyboardTap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        if (committedSv.value <= 0.5) {
          return;
        }
        if (keyboardHeightLib.value < -KB_OPEN_THRESHOLD_PX) {
          runOnJS(dismissKeyboard)();
        }
      }),
    [committedSv, dismissKeyboard, keyboardHeightLib],
  );

  const curtainStyle = useAnimatedStyle(() => ({
    height: pullProgress.value * curtainMaxHeightSv.value,
  }));

  const starsFadeStyle = useAnimatedStyle(() => ({
    opacity: computeStarsOpacity(pullProgress.value),
  }));

  const noiseFadeStyle = useAnimatedStyle(() => ({
    opacity: computeStarsOpacity(pullProgress.value),
  }));

  const inputPanelStyle = useAnimatedStyle(() => {
    const isCommitted = committedSv.value > 0.5;
    const reveal = computeInputReveal(
      pullProgress.value,
      inputExpand.value,
      isCommitted,
    );
    const kbLift = isCommitted ? computeAriaPanelKbLift(keyboardHeightLib.value) : 0;
    return {
      height: reveal * INPUT_PANEL_H,
      opacity: interpolate(reveal, [0, 0.12, 1], [0, 1, 1], Extrapolation.CLAMP),
      borderWidth: interpolate(reveal, [0, 0.22, 1], [0, 0, 0.5], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(reveal, [0, 1], [14, 0], Extrapolation.CLAMP) + kbLift,
        },
      ],
    };
  }, [keyboardHeightLib]);

  /** Лента: bottom уже зарезервирован; без ListHeader-spacer; тот же kbLift, что у input. */
  const messageListHostStyle = useAnimatedStyle(() => {
    if (committedSv.value <= 0.5) {
      return {};
    }
    return {
      transform: [{ translateY: computeAriaPanelKbLift(keyboardHeightLib.value) }],
    };
  }, [committedSv, keyboardHeightLib]);

  const inputContentStyle = useAnimatedStyle(() => {
    const isCommitted = committedSv.value > 0.5;
    const reveal = computeInputReveal(
      pullProgress.value,
      inputExpand.value,
      isCommitted,
    );
    return {
      opacity: interpolate(reveal, [0, 0.45, 1], [0, 0, 1], Extrapolation.CLAMP),
    };
  });

  return (
    <View
      style={styles.root}
      pointerEvents={committed ? 'box-none' : 'none'}
      collapsable={false}
    >
      <Animated.View
        style={[styles.curtain, { top: headerMinHeight }, curtainStyle]}
      >
        <Animated.View
          style={[styles.contentBackdrop, starsFadeStyle]}
          pointerEvents="none"
        >
          <AriaPanelStarsBackdrop />
        </Animated.View>
        <Animated.View style={[styles.noiseWrap, noiseFadeStyle]} pointerEvents="none">
          <CurtainNoise />
        </Animated.View>
        <Animated.View
          style={[styles.messageListHost, messageListHostStyle]}
          pointerEvents={committed ? 'auto' : 'none'}
        >
          <AriaPanelMessageList
            messages={ariaMessages}
            nickname={
              typeof ariaDisplayNickname === 'string' ? ariaDisplayNickname : ''
            }
            scrollEnabled={committed}
          />
        </Animated.View>
        <GestureDetector gesture={dismissKeyboardTap}>
          <Animated.View
            style={[styles.inputPanel, inputPanelStyle]}
            pointerEvents={committed ? 'auto' : 'none'}
          >
            <Animated.View
              style={[styles.inputContent, inputContentStyle]}
              pointerEvents={committed ? 'auto' : 'none'}
            >
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Спроси Арию..."
                placeholderTextColor={PLACEHOLDER_COLOR}
                multiline
                style={styles.input}
                selectionColor={V.accentSage}
              />
              <View style={styles.inputBottomRow}>
                <TouchableOpacity
                  style={styles.micButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Голосовой ввод"
                >
                  <Mic size={18} color={V.textMuted} strokeWidth={1.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    !canSendDraft && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSendPress}
                  disabled={!canSendDraft}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Отправить"
                  accessibilityState={{ disabled: !canSendDraft }}
                >
                  <Send size={18} color="#FFFFFF" strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
        <AriaPanelDismissHandle
          pullProgress={pullProgress}
          curtainMaxHeightSv={curtainMaxHeightSv}
          committedSv={committedSv}
          onClose={requestClose}
          pointerEvents={committed ? 'auto' : 'none'}
          style={styles.dismissHandle}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    elevation: 5,
  },
  curtain: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: CURTAIN_BG,
    overflow: 'hidden',
  },
  contentBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: CONTENT_BOTTOM_RESERVE,
    overflow: 'hidden',
  },
  backdropLayers: {
    flex: 1,
  },
  backdropImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backdropScrim: {
    backgroundColor: V.bgApp,
    opacity: STARS_SCRIM_OPACITY,
  },
  noiseWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  messageListHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: CONTENT_BOTTOM_RESERVE,
    zIndex: 2,
    elevation: 2,
  },
  inputPanel: {
    position: 'absolute',
    left: INPUT_HORIZONTAL,
    right: INPUT_HORIZONTAL,
    bottom: INPUT_BOTTOM + DISMISS_HANDLE_H,
    zIndex: 3,
    elevation: 3,
    backgroundColor: PANEL_BG,
    borderColor: PANEL_BORDER,
    borderRadius: 24,
    overflow: 'hidden',
  },
  inputContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  input: {
    height: INPUT_TEXT_H,
    fontSize: 13,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    textAlignVertical: 'top',
  },
  inputBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  micButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: V.accentSage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  dismissHandle: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: DISMISS_HANDLE_H,
    zIndex: 4,
    elevation: 4,
  },
});
