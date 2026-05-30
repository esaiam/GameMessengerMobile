import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withTiming,
  type SharedValue,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { Mic, Video as VideoIcon } from '../../icons/lucideIcons';
import { V } from '../../theme';
import {
  MIC_INNER,
  MIC_OUTER,
  MIC_ICON_SPEC,
  MIC_ICON_ON_SAGE,
  EDGE_GLOW_SIZE,
} from './voiceRecorderConstants';

type MicPanGesture = ReturnType<typeof Gesture.Pan>;

export interface ComposerMicButtonProps {
  gesture: MicPanGesture;
  micAnimStyle: AnimatedStyle<ViewStyle>;
  edgeGlowSV: SharedValue<number>;
  isMicActive: boolean;
  /** Только audio FSM — для morph иконки; video lock держит Video icon. */
  isAudioRecording: boolean;
  isVideoRecording: boolean;
  isVideoLocked: boolean;
  allowVideoRecording: boolean;
  mediaMode: 'audio' | 'video';
}

export function ComposerMicButton({
  gesture,
  micAnimStyle,
  edgeGlowSV,
  isMicActive,
  isAudioRecording,
  isVideoRecording,
  isVideoLocked,
  allowVideoRecording,
  mediaMode,
}: ComposerMicButtonProps) {
  const isIos = Platform.OS === 'ios';
  const modeMorphSV = useSharedValue(mediaMode === 'video' ? 1 : 0);
  const isAudioRecordingSV = useSharedValue(isAudioRecording ? 1 : 0);

  useEffect(() => {
    modeMorphSV.value = withTiming(mediaMode === 'video' ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [mediaMode, modeMorphSV]);

  useEffect(() => {
    isAudioRecordingSV.value = isAudioRecording ? 1 : 0;
  }, [isAudioRecording, isAudioRecordingSV]);

  const edgeGlowAnimStyle = useAnimatedStyle(() => {
    'worklet';
    const t = edgeGlowSV.value;
    if (isIos) {
      return {
        shadowColor: V.accentSage,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.05 + t * 0.05,
        shadowRadius: 2 + t * 2,
      };
    }
    return {
      elevation: 2 + t * 0.8,
    };
  });

  const micIconMicAnimStyle = useAnimatedStyle(() => {
    const audioActive = isAudioRecordingSV.value > 0.5;
    if (audioActive) return { opacity: 1, transform: [{ scale: 1 }] };
    const t = 1 - modeMorphSV.value;
    const op = interpolate(t, [0, 1], [0, 1]);
    const rot = interpolate(t, [0, 1], [90, 0]);
    const sc = interpolate(t, [0, 1], [0.92, 1]);
    return {
      opacity: op,
      transform: [{ perspective: 480 }, { rotateY: `${rot}deg` }, { scale: sc }],
    } as ViewStyle;
  });

  const micIconVideoAnimStyle = useAnimatedStyle(() => {
    const audioActive = isAudioRecordingSV.value > 0.5;
    if (audioActive) return { opacity: 0, transform: [{ scale: 0.92 }] };
    const t = modeMorphSV.value;
    const op = interpolate(t, [0, 1], [0, 1]);
    const rot = interpolate(t, [0, 1], [-90, 0]);
    const sc = interpolate(t, [0, 1], [0.92, 1]);
    return {
      opacity: op,
      transform: [{ perspective: 480 }, { rotateY: `${rot}deg` }, { scale: sc }],
    } as ViewStyle;
  });

  const elevated = isMicActive || isVideoRecording || isVideoLocked;

  return (
    <View
      style={[styles.micPos, elevated && styles.micPosOnTop]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.micAssembly, micAnimStyle]}>
          {isMicActive ? (
            <Animated.View
              style={[styles.micEdgeGlow, edgeGlowAnimStyle]}
              pointerEvents="none"
            />
          ) : null}
          <View style={styles.micGlowRing} pointerEvents="none" />
          <View style={styles.micInsetWell} pointerEvents="none">
            <View
              style={[
                styles.micCircle,
                isMicActive ? styles.micCircleRecording : styles.micCircleIdle,
              ]}
            >
              {allowVideoRecording ? (
                <View style={styles.micIconStack} pointerEvents="none">
                  <Animated.View style={[styles.micIconAbs, micIconMicAnimStyle]}>
                    <Mic
                      size={MIC_ICON_SPEC}
                      color={MIC_ICON_ON_SAGE}
                      strokeWidth={1.5}
                    />
                  </Animated.View>
                  <Animated.View style={[styles.micIconAbs, micIconVideoAnimStyle]}>
                    <VideoIcon
                      size={MIC_ICON_SPEC}
                      color={MIC_ICON_ON_SAGE}
                      strokeWidth={1.5}
                    />
                  </Animated.View>
                </View>
              ) : (
                <Mic
                  size={MIC_ICON_SPEC}
                  color={MIC_ICON_ON_SAGE}
                  strokeWidth={1.5}
                />
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  micPos: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MIC_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 5,
  },
  micPosOnTop: {
    zIndex: 50,
    elevation: 50,
  },
  micAssembly: {
    width: MIC_OUTER,
    height: MIC_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micEdgeGlow: {
    position: 'absolute',
    width: EDGE_GLOW_SIZE,
    height: EDGE_GLOW_SIZE,
    borderRadius: EDGE_GLOW_SIZE / 2,
    backgroundColor: 'rgba(90,158,154,0.04)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  micGlowRing: {
    position: 'absolute',
    width: MIC_OUTER,
    height: MIC_OUTER,
    borderRadius: MIC_OUTER / 2,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  micInsetWell: {
    width: MIC_OUTER,
    height: MIC_OUTER,
    borderRadius: MIC_OUTER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.45)',
  },
  micCircle: {
    width: MIC_INNER,
    height: MIC_INNER,
    borderRadius: MIC_INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  micCircleIdle: {
    backgroundColor: V.accentSage,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.32)',
    borderLeftColor: 'rgba(0, 0, 0, 0.24)',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
  },
  micCircleRecording: {
    backgroundColor: V.accentSage,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.32)',
    borderLeftColor: 'rgba(0, 0, 0, 0.24)',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    borderRightColor: 'rgba(255, 255, 255, 0.07)',
  },
  micIconStack: {
    width: MIC_ICON_SPEC,
    height: MIC_ICON_SPEC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIconAbs: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
