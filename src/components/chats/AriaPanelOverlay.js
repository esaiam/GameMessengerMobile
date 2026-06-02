import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
import { ARIA_SNAP_OPEN_THRESHOLD } from '../../hooks/ariaPullProgress';
import { Mic, Send } from '../../icons/lucideIcons';
import { V } from '../../theme';

const INPUT_PANEL_H = 110;
const INPUT_BOTTOM = 8;
const INPUT_HORIZONTAL = 14;
const INPUT_TEXT_H = 52;
const CONTENT_FADE_MS = 250;
const INPUT_EXPAND_MS = 420;
const COMMIT_SPRING = { damping: 22, stiffness: 240, mass: 0.85 };
const INPUT_EXPAND_EASING = Easing.out(Easing.cubic);
/** Окно ввода — когда шторка почти у низа; узкий диапазон для drag, плавный ramp */
const INPUT_REVEAL_FROM = 0.996;

const CURTAIN_BG = V.bgChatsScreen;
const PANEL_BG = V.bgSurface;
const PANEL_BORDER = 'rgba(255,255,255,0.1)';
const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.25)';
/** Шторка не видна, пока не выросла достаточно — без горизонтальной полоски у шапки */
const CURTAIN_VISIBLE_FROM_PX = 28;

// Closing should be easier than opening: small upward flick should dismiss.
const DISMISS_CLOSE_THRESHOLD = 0.78;
const DISMISS_CLOSE_VELOCITY_Y = -900;

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

export default function AriaPanelOverlay({
  pullProgress,
  committedSv,
  committed,
  onClose,
  headerMinHeight,
}) {
  const { height: screenHeight } = useWindowDimensions();
  const curtainMaxHeight = Math.max(0, screenHeight - headerMinHeight);
  const curtainMaxHeightSv = useSharedValue(curtainMaxHeight);

  const [draft, setDraft] = useState('');
  const wasCommittedRef = useRef(false);

  const inputExpand = useSharedValue(0);
  const dismissStartProgress = useSharedValue(0);

  useEffect(() => {
    curtainMaxHeightSv.value = curtainMaxHeight;
  }, [curtainMaxHeight, curtainMaxHeightSv]);

  const requestClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

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

  const dismissGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetY(-10)
      .failOffsetX([-24, 24])
      .onStart(() => {
        'worklet';
        if (committedSv.value <= 0.5) {
          return;
        }
        dismissStartProgress.value = pullProgress.value;
      })
      .onUpdate((e) => {
        'worklet';
        if (committedSv.value <= 0.5) {
          return;
        }
        const maxH = curtainMaxHeightSv.value;
        if (maxH <= 0) {
          return;
        }
        // Swipe up (translationY < 0) decreases progress → closes.
        const delta = e.translationY / maxH;
        pullProgress.value = Math.max(
          0,
          Math.min(1, dismissStartProgress.value + delta),
        );
      })
      .onEnd((e) => {
        'worklet';
        if (committedSv.value <= 0.5) {
          return;
        }
        const shouldDismiss =
          pullProgress.value < DISMISS_CLOSE_THRESHOLD ||
          (e.velocityY != null && e.velocityY < DISMISS_CLOSE_VELOCITY_Y);
        if (shouldDismiss) {
          runOnJS(requestClose)();
          return;
        }
        pullProgress.value = withSpring(1, COMMIT_SPRING);
      });
  }, [committedSv, curtainMaxHeightSv, dismissStartProgress, pullProgress, requestClose]);

  const curtainStyle = useAnimatedStyle(() => {
    const height = pullProgress.value * curtainMaxHeightSv.value;
    return {
      height,
      opacity: interpolate(
        height,
        [0, CURTAIN_VISIBLE_FROM_PX, CURTAIN_VISIBLE_FROM_PX + 24],
        [0, 0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const inputPanelStyle = useAnimatedStyle(() => {
    const isCommitted = committedSv.value > 0.5;
    const reveal = computeInputReveal(
      pullProgress.value,
      inputExpand.value,
      isCommitted,
    );
    return {
      height: reveal * INPUT_PANEL_H,
      opacity: interpolate(reveal, [0, 0.12, 1], [0, 1, 1], Extrapolation.CLAMP),
      borderWidth: interpolate(reveal, [0, 0.22, 1], [0, 0, 0.5], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(reveal, [0, 1], [14, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

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
    <GestureDetector gesture={dismissGesture}>
      <View
        style={styles.root}
        pointerEvents={committed ? 'box-none' : 'none'}
        collapsable={false}
      >
        <Animated.View
          style={[styles.curtain, { top: headerMinHeight }, curtainStyle]}
        >
          <CurtainNoise />
          <Animated.View
            style={[styles.inputPanel, inputPanelStyle]}
            pointerEvents={committed ? 'auto' : 'none'}
          >
            <Animated.View
              style={[styles.inputContent, inputContentStyle]}
              pointerEvents={committed ? 'auto' : 'none'}
            >
              <TextInput
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
                  style={styles.sendButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Отправить"
                >
                  <Send size={18} color="#FFFFFF" strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
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
  inputPanel: {
    position: 'absolute',
    left: INPUT_HORIZONTAL,
    right: INPUT_HORIZONTAL,
    bottom: INPUT_BOTTOM,
    backgroundColor: PANEL_BG,
    borderColor: PANEL_BORDER,
    borderRadius: 18,
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
});
