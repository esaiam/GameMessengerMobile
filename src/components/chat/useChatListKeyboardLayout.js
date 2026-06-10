import { useRef, useCallback, useLayoutEffect } from 'react';
import { Platform } from 'react-native';
import { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import {
  useKeyboardHandler,
  KeyboardController,
  AndroidSoftInputModes,
} from 'react-native-keyboard-controller';
import {
  estimateComposerStackHeight,
  computeChatListScrollSpacer,
  computeChatListEmojiPanelInset,
} from './chatViewConstants';

/**
 * Inverted list keyboard/composer inset layout: stack height shared value, list viewport translate/spacer, Android input mode.
 * Depends on: insets, useChatInputSettling (armComposerInsetSettling, keyboardSettlingRef), useChatComposerChrome heights, listOpacity.
 */
export default function useChatListKeyboardLayout({
  insets,
  armComposerInsetSettling,
  keyboardSettlingRef,
  listOpacity,
  keyboardHeightLib,
  emojiPanelHeightShared,
}) {
  const lastComposerLayoutHRef = useRef(0);
  const pendingComposerHeightRef = useRef(null);

  const composerStackHeightShared = useSharedValue(estimateComposerStackHeight(insets));

  const applyComposerStackHeight = useCallback((layoutH) => {
    if (typeof layoutH !== 'number' || layoutH <= 0) return;
    if (Math.abs(layoutH - lastComposerLayoutHRef.current) < 0.5) return;
    lastComposerLayoutHRef.current = layoutH;
    composerStackHeightShared.value = layoutH;
    armComposerInsetSettling();
  }, [armComposerInsetSettling, composerStackHeightShared]);

  const flushPendingComposerStackHeight = useCallback(() => {
    const pending = pendingComposerHeightRef.current;
    if (pending == null) return;
    pendingComposerHeightRef.current = null;
    applyComposerStackHeight(pending);
  }, [applyComposerStackHeight]);

  /** Layout во время KB часто stale — на close сбрасываем, не применяем (рывок marginBottom). */
  const discardPendingComposerHeight = useCallback(() => {
    pendingComposerHeightRef.current = null;
  }, []);

  const reportComposerBaseHeight = useCallback((layoutH) => {
    if (typeof layoutH !== 'number' || layoutH <= 0) return;
    if (Math.abs(layoutH - lastComposerLayoutHRef.current) < 0.5) return;
    if (keyboardSettlingRef.current) {
      pendingComposerHeightRef.current = layoutH;
      return;
    }
    applyComposerStackHeight(layoutH);
  }, [applyComposerStackHeight, keyboardSettlingRef]);

  const listAnimatedStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  /**
   * Лента на всю высоту под glass-капсулой; marginBottom — только emoji-панель (opaque).
   * KB — translateY; scroll spacer — ListHeader (inverted bottom).
   */
  const listViewportStyle = useAnimatedStyle(() => ({
    marginBottom: computeChatListEmojiPanelInset(
      emojiPanelHeightShared.value,
      keyboardHeightLib.value,
    ),
    transform: [{ translateY: keyboardHeightLib.value }],
  }));

  const listBottomSpacerStyle = useAnimatedStyle(() => ({
    height: computeChatListScrollSpacer(
      composerStackHeightShared.value,
      emojiPanelHeightShared.value,
      keyboardHeightLib.value,
    ),
  }));

  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        if (e.height <= 0) {
          runOnJS(discardPendingComposerHeight)();
        }
      },
      onEnd: (e) => {
        'worklet';
        if (e.height <= 0) {
          runOnJS(discardPendingComposerHeight)();
        } else {
          runOnJS(flushPendingComposerStackHeight)();
        }
      },
    },
    [discardPendingComposerHeight, flushPendingComposerStackHeight],
  );

  /** Только manual lift; без resize окна (двойной offset). */
  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
    return () => {
      KeyboardController.setDefaultMode();
    };
  }, []);

  return {
    reportComposerBaseHeight,
    listAnimatedStyle,
    listViewportStyle,
    listBottomSpacerStyle,
  };
}
