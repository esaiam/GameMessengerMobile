import { useEffect, useRef, useCallback } from 'react';
import { Keyboard, Platform, Animated } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { REPLY_TARGET_PREVIEW_H, EMOJI_PICKER_PANEL_H } from './chatComposerConstants';
import { REPLY_TARGET_ANIM_MS } from './replyTargetLayoutAnimation';

/**
 * Клавиатура: только `paddingBottom` корня (`keyboardHeightShared`) — одна роль для K.
 * В `Chat` лента на весь `flex:1`, композер `absolute` внизу того же контейнера — лента рисуется под blur; низ
 * ленты — `ListHeaderComponent` + `composerStackHeightShared` (тот же UI-поток Reanimated, что и `keyboardHeightShared`).
 * Клавиатурный отступ на корне (`keyboardHeightShared`) поднимает и ленту, и якорь композера.
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
  const { height: keyboardHeightLib } = useReanimatedKeyboardAnimation();
  const replyTargetProgress = useSharedValue(0);
  const emojiPanelHeightShared = useSharedValue(0);

  // keyboardHeightLib: 0 → -keyboardHeight (отрицательное когда открыта)
  const rootAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: -keyboardHeightLib.value,
  }));

  const emojiPanelAnimatedStyle = useAnimatedStyle(() => ({
    height: emojiPanelHeightShared.value,
    overflow: 'hidden',
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

  // Схлопываем emoji-панель при появлении системной клавиатуры
  useEffect(() => {
    const evt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(evt, () => collapseEmojiForKeyboard());
    return () => sub.remove();
  }, [collapseEmojiForKeyboard]);

  useEffect(() => {
    if (showEmojiPicker) {
      skipEmojiPanelCloseAnimationRef.current = false;
      emojiPanelHeightShared.value = withTiming(EMOJI_PICKER_PANEL_H, {
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
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setShowEmojiPicker(true);
    }
  }, [showEmojiPicker, setShowEmojiPicker, inputRef]);

  const insertEmoji = useCallback((emoji) => {
    setText((prev) => prev + emoji);
  }, [setText]);

  return {
    rootAnimatedStyle,
    replyTargetAnimatedStyle,
    emojiPanelAnimatedStyle,
    emojiWobbleRotate,
    collapseEmojiForKeyboard,
    toggleEmojiPicker,
    insertEmoji,
  };
}
