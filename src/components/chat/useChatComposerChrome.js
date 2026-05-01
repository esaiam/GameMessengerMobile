import { useEffect, useRef, useCallback } from 'react';
import { Keyboard, Platform, Animated } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { REPLY_TARGET_PREVIEW_H } from './chatComposerConstants';
import { REPLY_TARGET_ANIM_MS } from './replyTargetLayoutAnimation';

/**
 * Клавиатура (padding root + translate composer), анимация превью ответа, wobble эмодзи-кнопки, пикер текста.
 */
export default function useChatComposerChrome({
  replyTo,
  setVisibleReplyTo,
  inputRef,
  showEmojiPicker,
  setShowEmojiPicker,
  setText,
}) {
  const keyboardHeightShared = useSharedValue(0);
  const replyTargetProgress = useSharedValue(0);

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightShared.value,
  }));

  const inputBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardHeightShared.value }],
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

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub1 = Keyboard.addListener(showEvt, (e) => {
      keyboardHeightShared.value = withTiming(e.endCoordinates.height, {
        duration: Platform.OS === 'ios' ? e.duration : 200,
      });
    });
    const sub2 = Keyboard.addListener(hideEvt, () => {
      keyboardHeightShared.value = withTiming(0, { duration: 200 });
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

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
    inputBarAnimatedStyle,
    replyTargetAnimatedStyle,
    emojiWobbleRotate,
    toggleEmojiPicker,
    insertEmoji,
  };
}
