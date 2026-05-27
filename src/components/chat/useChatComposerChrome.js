import { useEffect, useRef, useCallback } from 'react';
import { Keyboard, Animated, Platform } from 'react-native';
import { KeyboardController } from 'react-native-keyboard-controller';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation, useKeyboardHandler } from 'react-native-keyboard-controller';
import {
  REPLY_TARGET_PREVIEW_H,
  EMOJI_GIF_EXPANDED_VISIBLE_H } from './chatComposerConstants';
import { REPLY_TARGET_ANIM_MS } from './replyTargetLayoutAnimation';
import {
  estimateKeyboardHeight,
  resolveKeyboardPanelHeight,
  saveCachedKeyboardHeight,
  clampKeyboardHeight } from '../../lib/keyboardHeightCache';

let composerKeyboardReleaseInFlight = false;

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
  emojiPanelGifSearchFocused = false }) {
  // 0 → -keyboardHeight (отрицательное когда открыта)
  const { height: keyboardHeightLib } = useReanimatedKeyboardAnimation();
  const replyTargetProgress = useSharedValue(0);
  const emojiPanelHeightShared = useSharedValue(0);
  /** Непрозрачность контента эмодзи: 1 — виден, 0 — мгновенно прячется при старте анимации клавиатуры */
  const emojiContentOpacityShared = useSharedValue(1);
  /** Высота панели эмодзи ≈ soft-keyboard (кэш / эвристика / live). */
  const storedKeyboardHeightShared = useSharedValue(estimateKeyboardHeight());
  const emojiPanelGifSearchFocusedShared = useSharedValue(false);
  const lastPersistedKbHRef = useRef(0);

  const applyStoredKeyboardHeight = useCallback((h) => {
    const clamped = clampKeyboardHeight(h);
    if (clamped == null) return;
    storedKeyboardHeightShared.value = clamped;
  }, [storedKeyboardHeightShared]);

  const persistKeyboardHeight = useCallback((h) => {
    const clamped = clampKeyboardHeight(h);
    if (clamped == null) return;
    if (Math.abs(clamped - lastPersistedKbHRef.current) < 4) return;
    lastPersistedKbHRef.current = clamped;
    applyStoredKeyboardHeight(clamped);
    saveCachedKeyboardHeight(clamped);
  }, [applyStoredKeyboardHeight]);

  useEffect(() => {
    emojiPanelGifSearchFocusedShared.value = emojiPanelGifSearchFocused;
  }, [emojiPanelGifSearchFocused, emojiPanelGifSearchFocusedShared]);

  useEffect(() => {
    let cancelled = false;
    resolveKeyboardPanelHeight().then((h) => {
      if (!cancelled) applyStoredKeyboardHeight(h);
    });
    return () => {
      cancelled = true;
    };
  }, [applyStoredKeyboardHeight]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvt, (e) => {
      const h = e?.endCoordinates?.height;
      if (typeof h === 'number' && h > 100) persistKeyboardHeight(h);
    });
    return () => sub.remove();
  }, [persistKeyboardHeight]);

  useAnimatedReaction(
    () => keyboardHeightLib.value,
    (current, previous) => {
      const h = -current;
      const prevH = previous != null ? -previous : 0;
      if (h > 100) {
        const clamped = Math.min(520, Math.max(200, Math.round(h)));
        storedKeyboardHeightShared.value = clamped;
      }
      // После закрытия клавиатуры при открытой панели эмодзи — вернуть слот к kbStored.
      if (
        h < 50 &&
        prevH > 100 &&
        !emojiPanelGifSearchFocusedShared.value &&
        emojiPanelHeightShared.value > 0
      ) {
        emojiPanelHeightShared.value = storedKeyboardHeightShared.value;
      }
    },
  );

  // Высота панели убывает синхронно с ростом клавиатуры → капсула не двигается
  const emojiPanelAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(0, emojiPanelHeightShared.value + keyboardHeightLib.value),
    overflow: 'hidden' }));

  // Контент (сетка эмодзи) — исчезает как только клавиатура начинает выезжать поверх; слот остаётся
  const emojiContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: emojiContentOpacityShared.value }));

  const replyTargetAnimatedStyle = useAnimatedStyle(() => {
    const p = replyTargetProgress.value;
    return {
      height: REPLY_TARGET_PREVIEW_H * p,
      opacity: p,
      transform: [{ translateY: (1 - p) * REPLY_TARGET_PREVIEW_H }] };
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

  /** Уход с экрана чата: blur → emoji panel → dismiss (не блокирует navigation). */
  const releaseComposerKeyboard = useCallback(() => {
    inputRef.current?.blur?.();
    collapseEmojiForKeyboard();
    Keyboard.dismiss();
    if (composerKeyboardReleaseInFlight) return;
    composerKeyboardReleaseInFlight = true;
    void KeyboardController.dismiss({ animated: false })
      .catch(() => {})
      .finally(() => {
        composerKeyboardReleaseInFlight = false;
      });
  }, [inputRef, collapseEmojiForKeyboard]);

  useEffect(() => {
    return () => {
      releaseComposerKeyboard();
    };
  }, [releaseComposerKeyboard]);

  const playEmojiWobble = useCallback(() => {
    emojiWobbleRotate.setValue(0);
    Animated.sequence([
      Animated.timing(emojiWobbleRotate, { toValue: -12, duration: 80, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 12, duration: 100, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: -7, duration: 90, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 7, duration: 70, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 0, duration: 90, useNativeDriver: true })]).start();
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
        easing: Easing.out(Easing.cubic) });
      return;
    }

    replyTargetProgress.value = withTiming(
      0,
      {
        duration: REPLY_TARGET_ANIM_MS,
        easing: Easing.in(Easing.cubic) },
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
      if (e.height > 0 && emojiPanelGifSearchFocusedShared.value && emojiPanelHeightShared.value > 0) {
        emojiContentOpacityShared.value = 1;
        emojiPanelHeightShared.value = EMOJI_GIF_EXPANDED_VISIBLE_H + e.height;
        return;
      }
      if (
        e.height > 0 &&
        emojiPanelHeightShared.value > 0 &&
        !emojiPanelGifSearchFocusedShared.value
      ) {
        emojiContentOpacityShared.value = 0;
      }
    },
    onEnd: (e) => {
      'worklet';
      if (
        e.height > 0 &&
        emojiPanelHeightShared.value > 0 &&
        !emojiPanelGifSearchFocusedShared.value
      ) {
        emojiPanelHeightShared.value = 0;
        runOnJS(setShowEmojiPicker)(false);
      }
    } }, [setShowEmojiPicker]);

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
      const kbH = storedKeyboardHeightShared.value;
      emojiPanelHeightShared.value = withTiming(kbH, {
        duration: 280,
        easing: Easing.out(Easing.cubic) });
      return;
    }
    const instant = skipEmojiPanelCloseAnimationRef.current;
    skipEmojiPanelCloseAnimationRef.current = false;
    emojiPanelHeightShared.value = withTiming(0, {
      duration: instant ? 0 : 280,
      easing: Easing.out(Easing.cubic) });
  }, [showEmojiPicker]);

  /** Только при входе в режим поиска GIF — не трогаем высоту при выходе (blur / вкладка). */
  useEffect(() => {
    if (!showEmojiPicker || !emojiPanelGifSearchFocused) return;
    const openKb = Math.max(0, -keyboardHeightLib.value);
    emojiPanelHeightShared.value = withTiming(EMOJI_GIF_EXPANDED_VISIBLE_H + openKb, {
      duration: 280,
      easing: Easing.out(Easing.cubic) });
  }, [showEmojiPicker, emojiPanelGifSearchFocused, keyboardHeightLib]);

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

  /** До анимации клавиатуры — панель растёт вверх, контент не гасится. */
  const prepareEmojiPanelGifSearch = useCallback(() => {
    emojiPanelGifSearchFocusedShared.value = true;
    emojiContentOpacityShared.value = 1;
    skipEmojiPanelCloseAnimationRef.current = true;
    cancelAnimation(emojiPanelHeightShared);
    const openKb = Math.max(0, -keyboardHeightLib.value);
    emojiPanelHeightShared.value = EMOJI_GIF_EXPANDED_VISIBLE_H + openKb;
  }, [keyboardHeightLib]);

  /** Выход с вкладки GIF → эмодзи: всегда полный слот kbH, клавиатуру гасим. */
  const exitGifTabLayout = useCallback(() => {
    emojiPanelGifSearchFocusedShared.value = false;
    if (!showEmojiPicker) return;
    Keyboard.dismiss();
    cancelAnimation(emojiPanelHeightShared);
    const kbH = storedKeyboardHeightShared.value;
    emojiPanelHeightShared.value = withTiming(kbH, {
      duration: 280,
      easing: Easing.out(Easing.cubic) });
  }, [showEmojiPicker]);

  const releaseEmojiPanelGifSearch = useCallback(() => {
    emojiPanelGifSearchFocusedShared.value = false;
    if (!showEmojiPicker) return;
    Keyboard.dismiss();
    cancelAnimation(emojiPanelHeightShared);
    const kbH = storedKeyboardHeightShared.value;
    const openKb = Math.max(0, -keyboardHeightLib.value);
    const targetH = openKb > 50 ? kbH + openKb : kbH;
    emojiPanelHeightShared.value = withTiming(targetH, {
      duration: 280,
      easing: Easing.out(Easing.cubic) });
  }, [showEmojiPicker, keyboardHeightLib]);

  return {
    keyboardHeightLib,
    emojiPanelHeightShared,
    replyTargetAnimatedStyle,
    emojiPanelAnimatedStyle,
    emojiContentAnimatedStyle,
    emojiWobbleRotate,
    collapseEmojiForKeyboard,
    releaseComposerKeyboard,
    toggleEmojiPicker,
    insertEmoji,
    prepareEmojiPanelGifSearch,
    releaseEmojiPanelGifSearch,
    exitGifTabLayout };
}
