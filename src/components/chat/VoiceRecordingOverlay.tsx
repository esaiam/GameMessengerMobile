import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Lock, Unlock, Trash2, Pause } from '../../icons/lucideIcons';
import { V, TAB_BAR_LAYOUT, COMPOSER_LAYOUT, COMPOSER_CAPSULE_RADIUS } from '../../theme';
import {
  DEPTH,
  MIC_OUTER,
  FLOAT_ICON_CIRCLE,
  LOCK_FLOAT_EXTRA,
} from './voiceRecorderConstants';
import { fmtDur } from './voiceWaveformUtils';

type AnimViewStyle = AnimatedStyle<ViewStyle>;

export interface VoiceRecordingOverlayProps {
  /** Lock/Unlock float above mic (audio RECORDING or video pre-lock) */
  showLockFloat: boolean;
  /** Pause above mic when audio LOCKED */
  showPauseAbove: boolean;
  /** Capsule overlay (audio RECORDING | LOCKED) */
  isOverlayActive: boolean;
  state: 'RECORDING' | 'LOCKED';
  dur: number;
  cancelActive: boolean;
  lockAboveAnimStyle: AnimViewStyle;
  lockLockFadeStyle: AnimViewStyle;
  lockUnlockFadeStyle: AnimViewStyle;
  overlayAnimStyle: AnimViewStyle;
  dotAnimStyle: AnimViewStyle;
  onPause: () => void;
  onCancel: () => void;
}

export function VoiceRecordingOverlay({
  showLockFloat,
  showPauseAbove,
  isOverlayActive,
  state,
  dur,
  cancelActive,
  lockAboveAnimStyle,
  lockLockFadeStyle,
  lockUnlockFadeStyle,
  overlayAnimStyle,
  dotAnimStyle,
  onPause,
  onCancel,
}: VoiceRecordingOverlayProps) {
  return (
    <>
      {showLockFloat ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.lockAbove, styles.floatingIconCircle, lockAboveAnimStyle]}
        >
          <View style={styles.lockIconPair}>
            <Animated.View style={lockLockFadeStyle}>
              <Lock size={16} color={V.textSecondary} strokeWidth={1.5} />
            </Animated.View>
            <Animated.View style={[styles.lockUnlockAbs, lockUnlockFadeStyle]}>
              <Unlock size={16} color={V.accentSage} strokeWidth={1.5} />
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      {showPauseAbove ? (
        <View pointerEvents="box-none" style={[styles.lockAbove, styles.lockAboveLocked]}>
          <TouchableOpacity
            onPress={onPause}
            style={[styles.floatingIconCircle, styles.pauseAboveBtn]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Пауза"
          >
            <Pause size={16} color={V.accentSage} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Animated.View
        pointerEvents={isOverlayActive ? 'auto' : 'none'}
        style={[styles.overlay, overlayAnimStyle]}
      >
        {isOverlayActive ? (
          <>
            <View style={styles.timerRow}>
              <Animated.View style={[styles.dot, dotAnimStyle]} />
              <Text style={styles.timerText}>{fmtDur(dur)}</Text>
            </View>

            {state === 'RECORDING' ? (
              <Text
                style={[styles.hintText, cancelActive && styles.hintActive]}
                numberOfLines={1}
              >
                {'← Slide to cancel'}
              </Text>
            ) : (
              <View style={styles.lockedRow}>
                <TouchableOpacity
                  onPress={onCancel}
                  style={styles.lockedCancelBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  accessibilityLabel="Отмена"
                >
                  <Trash2 size={18} color={V.dangerMuted} strokeWidth={1.5} />
                </TouchableOpacity>
                <View style={styles.lockedRowSpacer} />
              </View>
            )}

            <View style={styles.micSpacer} />
          </>
        ) : null}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: DEPTH,
    left: DEPTH,
    right: DEPTH,
    bottom: DEPTH,
    borderRadius: COMPOSER_CAPSULE_RADIUS,
    backgroundColor: V.bgSurface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
    minHeight: COMPOSER_LAYOUT.innerHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    overflow: 'hidden',
  },
  lockAbove: {
    position: 'absolute',
    right: Math.round((MIC_OUTER - FLOAT_ICON_CIRCLE) / 2),
    bottom: COMPOSER_LAYOUT.innerHeight + DEPTH * 2 + 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  floatingIconCircle: {
    width: FLOAT_ICON_CIRCLE,
    height: FLOAT_ICON_CIRCLE,
    borderRadius: FLOAT_ICON_CIRCLE / 2,
    backgroundColor: V.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lockAboveLocked: {
    transform: [{ translateY: -LOCK_FLOAT_EXTRA }],
    zIndex: 30,
  },
  lockIconPair: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockUnlockAbs: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseAboveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: V.dangerMuted,
  },
  timerText: {
    fontSize: 13,
    color: V.textPrimary,
    fontWeight: '500',
    minWidth: 36,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    color: V.textMuted,
    fontWeight: '400',
    textAlign: 'center',
  },
  hintActive: {
    color: V.dangerMuted,
  },
  lockedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  lockedCancelBtn: {
    width: COMPOSER_LAYOUT.innerHeight,
    height: COMPOSER_LAYOUT.innerHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedRowSpacer: {
    flex: 1,
  },
  micSpacer: {
    width: MIC_OUTER,
    height: COMPOSER_LAYOUT.innerHeight,
  },
});
