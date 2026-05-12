import { useEffect, useRef, useCallback } from 'react';
import { Keyboard, Animated } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation, useKeyboardHandler } from 'react-native-keyboard-controller';
import { REPLY_TARGET_PREVIEW_H, EMOJI_PICKER_PANEL_H } from './chatComposerConstants';
import { REPLY_TARGET_ANIM_MS } from './replyTargetLayoutAnimation';

/**
 * Клавиатура: `keyboardHeightLib` (UI thread) — сдвиг overlay-композера и нижний inset ленты.
 * Анимация превью ответа, wobble эмодзи-кнопки, пикер текста.
 * Панель эмодзи: при уходе на клавиатуру — мгновенное закрытие без конкурирующего withTiming(280).
 */
export default function useChatComposerChrome({
  replyTo,
  setVisibleReplyTo,
  inputRef,
  showEmojiPicker,
  setShowEmojiPicker,
  setText,
}) {
  // 0 → -keyboardHeight (отрицательное когда открыта)
  const { height: keyboardHeightLib } = useReanimatedKeyboardAnimation();
  const replyTargetProgress = useSharedValue(0);
  const emojiPanelHeightShared = useSharedValue(0);
  /** Непрозрачность контента эмодзи: 1 — виден, 0 — мгновенно прячется при старте анимации клавиатуры */
  const emojiContentOpacityShared = useSharedValue(1);
  /** Последняя реальная высота системной клавиатуры; fallback = EMOJI_PICKER_PANEL_H */
  const storedKeyboardHeightShared = useSharedValue(EMOJI_PICKER_PANEL_H);

  useAnimatedReaction(
    () => keyboardHeightLib.value,
    (current) => {
      const h = -current;
      if (h > 100) {
        storedKeyboardHeightShared.value = h;
      }
    },
  );

  // Высота панели убывает синхронно с ростом клавиатуры → капсула не двигается
  const emojiPanelAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(0, emojiPanelHeightShared.value + keyboardHeightLib.value),
    overflow: 'hidden',
  }));

  // Контент (сетка эмодзи) — исчезает как только клавиатура начинает выезжать поверх; слот остаётся
  const emojiContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: emojiContentOpacityShared.value,
  }));

  const replyTargetAnimatedStyle = useAnimatedStyle(() => {
    const p = replyTargetProgress.value;
    return {
      height: REPLY_TARGET_PREVIEW_H * p,
      opacity: p,
      transform: [{ translateY: (1 - p) * REPLY_TARGET_PREVIEW_H }],
    };
  });

  const emojiWobbleRotate = useRef(new Animated.Value(0)).current;
  /** true → следующее закрытие панели без 280ms (клавиатура / фокус инпута) */
  const skipEmojiPanelCloseAnimationRef = useRef(false);
  /** true → панель уже выставлена в полный рост в toggleEmojiPicker (handoff с клавиатуры) */
  const openedFromKeyboardRef = useRef(false);

  /** Сразу убирает панель эмодзи (место под системную клавиатуру), затем выключает флаг */
  const collapseEmojiForKeyboard = useCallback(() => {
    skipEmojiPanelCloseAnimationRef.current = true;
    cancelAnimation(emojiPanelHeightShared);
    emojiPanelHeightShared.value = 0;
    setShowEmojiPicker(false);
  }, [setShowEmojiPicker]);

  const playEmojiWobble = useCallback(() => {
    emojiWobbleRotate.setValue(0);
    Animated.sequence([
      Animated.timing(emojiWobbleRotate, { toValue: -12, duration: 80, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 12, duration: 100, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: -7, duration: 90, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 7, duration: 70, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [emojiWobbleRotate]);

  useEffect(() => {
    const t = setTimeout(playEmojiWobble, 300);
    return () => clearTimeout(t);
  }, [playEmojiWobble]);

  useEffect(() => {
    if (replyTo) {
      setVisibleReplyTo(replyTo);
      replyTargetProgress.value = withTiming(1, {
        duration: REPLY_TARGET_ANIM_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    replyTargetProgress.value = withTiming(
      0,
      {
        duration: REPLY_TARGET_ANIM_MS,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) runOnJS(setVisibleReplyTo)(null);
      },
    );
  }, [replyTo, replyTargetProgress, setVisibleReplyTo]);

  // Как в Telegram: контент эмодзи исчезает мгновенно при старте анимации клавиатуры;
  // слот (оболочка) остаётся и клавиатура едет поверх него.
  // После полного открытия клавиатуры тихо схлопываем панель.
  useKeyboardHandler({
    onStart: (e) => {
      'worklet';
      if (e.height > 0 && emojiPanelHeightShared.value > 0) {
        emojiContentOpacityShared.value = 0;
      }
    },
    onEnd: (e) => {
      'worklet';
      if (e.height > 0 && emojiPanelHeightShared.value > 0) {
        emojiPanelHeightShared.value = 0;
        runOnJS(setShowEmojiPicker)(false);
      }
    },
  }, []);

  useEffect(() => {
    if (showEmojiPicker) {
      skipEmojiPanelCloseAnimationRef.current = false;
      emojiContentOpacityShared.value = 1;
      if (openedFromKeyboardRef.current) {
        // Высота уже выставлена в toggleEmojiPicker — без withTiming,
        // чтобы visualEmojiH + kbH оставалось константой на handoff.
        openedFromKeyboardRef.current = false;
        return;
      }
      emojiPanelHeightShared.value = withTiming(storedKeyboardHeightShared.value, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    const instant = skipEmojiPanelCloseAnimationRef.current;
    skipEmojiPanelCloseAnimationRef.current = false;
    emojiPanelHeightShared.value = withTiming(0, {
      duration: instant ? 0 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [showEmojiPicker]);

  const toggleEmojiPicker = useCallback(() => {
    if (showEmojiPicker) {
      inputRef.current?.focus();
    } else {
      // Handoff клавиатура → эмодзи: ставим панель в полный рост ДО dismiss,
      // нативная анимация клавиатуры сама её «вскроет» через max(0, emojiPanelH + keyboardHeightLib).
      if (keyboardHeightLib.value < -50) {
        cancelAnimation(emojiPanelHeightShared);
        emojiPanelHeightShared.value = storedKeyboardHeightShared.value;
        openedFromKeyboardRef.current = true;
      }
      Keyboard.dismiss();
      setShowEmojiPicker(true);
    }
  }, [showEmojiPicker, setShowEmojiPicker, inputRef]);

  const insertEmoji = useCallback((emoji) => {
    setText((prev) => prev + emoji);
  }, [setText]);

  return {
    keyboardHeightLib,
    emojiPanelHeightShared,
    replyTargetAnimatedStyle,
    emojiPanelAnimatedStyle,
    emojiContentAnimatedStyle,
    emojiWobbleRotate,
    collapseEmojiForKeyboard,
    toggleEmojiPicker,
    insertEmoji,
  };
}
