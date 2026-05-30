import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { VideoView } from 'expo-video';
import Svg, { Circle } from 'react-native-svg';
import { V } from '../../theme';
import {
  CIRCLE_IDLE,
  CIRCLE_ACTIVE,
  R_IDLE,
  R_ACTIVE,
  RING_C,
  RING_STROKE,
  RING_R,
  KNOB_R,
  KNOB_ORBIT_R,
  RING_CIRC,
  RING_TRACK,
  IDLE_WARMUP_TEXTURE,
} from './videoMessageConstants';
import type { VideoMessageProps } from './videoMessageTypes';
import { useVideoMessagePlayer } from '../../hooks/useVideoMessagePlayer';

export default function VideoMessage({
  url,
  messageId,
  activeVideoId,
  wasActivated,
  onActivate,
  onLongPress,
  isUploading = false,
}: VideoMessageProps) {
  const isActive = activeVideoId === messageId;
  const sizeAnim = useRef(new Animated.Value(CIRCLE_IDLE)).current;
  const prevIsActiveRef = useRef(isActive);

  const onCloseActive = useCallback(() => onActivate(null), [onActivate]);

  const {
    player,
    activated,
    thumbUri,
    idlePreviewReady,
    streamRenderReady,
    progress01,
    isScrubbingUi,
    handleRingLayout,
    ringPanHandlers,
  } = useVideoMessagePlayer({
    url,
    isActive,
    wasActivated,
    onCloseActive,
  });

  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;

    if (isActive && !wasActive) {
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_ACTIVE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200,
      }).start();
      return;
    }

    if (!isActive && wasActive) {
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_IDLE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200,
      }).start();
    }
  }, [isActive, sizeAnim]);

  const togglePlay = useCallback(() => {
    if (isActive) {
      onActivate(null);
    } else {
      onActivate(messageId);
    }
  }, [isActive, messageId, onActivate]);

  const borderRadius = sizeAnim.interpolate({
    inputRange: [CIRCLE_IDLE, CIRCLE_ACTIVE],
    outputRange: [R_IDLE, R_ACTIVE],
  });

  const showIdleLoadingVeil = !isActive && !idlePreviewReady;
  const showActiveStreamVeil = isActive && !streamRenderReady && !isScrubbingUi;
  const veilPosterSource =
    showActiveStreamVeil && thumbUri ? { uri: thumbUri } : IDLE_WARMUP_TEXTURE;

  const progressClamped = Math.min(1, Math.max(0, progress01));
  const knobAngle = progressClamped * 2 * Math.PI - Math.PI / 2;
  const knobX = RING_C + KNOB_ORBIT_R * Math.cos(knobAngle);
  const knobY = RING_C + KNOB_ORBIT_R * Math.sin(knobAngle);
  const knobSizePct = KNOB_R * 2;

  return (
    <Pressable
      onPress={isUploading || isActive ? undefined : togglePlay}
      onLongPress={isUploading || isActive ? undefined : onLongPress}
      disabled={isUploading}
      delayLongPress={400}
      accessibilityLabel={isActive ? 'Пауза' : 'Воспроизвести видео'}
      style={({ pressed }) => ({
        transform: [{ scale: pressed && !isActive ? 1.04 : 1 }],
      })}
    >
      <Animated.View
        onLayout={handleRingLayout}
        style={{
          width: sizeAnim,
          height: sizeAnim,
          borderRadius,
          overflow: 'visible',
        }}
      >
        {/* Круговой клип только здесь: у предка VideoView не держим overflow+native-driver scale/opacity — иначе после смены layout (выделение и т.п.) поверхность может не рисоваться. */}
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: V.bgElevated,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: V.border,
          }}
        >
          {(activated || isActive) && player ? (
            <VideoView
              pointerEvents="none"
              player={player}
              style={[StyleSheet.absoluteFill, styles.videoLayer]}
              contentFit="cover"
              nativeControls={false}
              {...(Platform.OS === 'android' ? { surfaceType: 'textureView' } : {})}
            />
          ) : null}

          {(showIdleLoadingVeil || showActiveStreamVeil) && (
            <View style={[StyleSheet.absoluteFill, styles.veilLayer]} pointerEvents="none">
              <Image
                source={veilPosterSource}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </View>
          )}

          {!isActive && idlePreviewReady && thumbUri && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.thumbLayer]}>
              <Animated.Image
                source={{ uri: thumbUri }}
                style={[StyleSheet.absoluteFill, { borderRadius }]}
                resizeMode="cover"
              />
            </View>
          )}

          {isUploading ? (
            <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]} pointerEvents="none">
              <ActivityIndicator size="small" color={V.accentSage} />
            </View>
          ) : null}
        </Animated.View>

        {isActive ? (
          <View style={styles.progressRing} {...ringPanHandlers}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100" pointerEvents="none">
              <Circle
                cx={RING_C}
                cy={RING_C}
                r={RING_R}
                stroke={RING_TRACK}
                strokeWidth={RING_STROKE}
                fill="transparent"
              />
              {progressClamped > 0 ? (
                <Circle
                  cx={RING_C}
                  cy={RING_C}
                  r={RING_R}
                  stroke={V.accentSage}
                  strokeWidth={RING_STROKE}
                  fill="transparent"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={(1 - progressClamped) * RING_CIRC}
                  transform={`rotate(-90 ${RING_C} ${RING_C})`}
                />
              ) : null}
            </Svg>
            <View
              pointerEvents="none"
              style={[
                styles.knobDot,
                {
                  left: `${knobX}%`,
                  top: `${knobY}%`,
                  width: `${knobSizePct}%`,
                  height: `${knobSizePct}%`,
                  marginLeft: `${-KNOB_R}%`,
                  marginTop: `${-KNOB_R}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  videoLayer: {
    zIndex: 1,
  },
  veilLayer: {
    zIndex: 3,
  },
  thumbLayer: {
    zIndex: 2,
  },
  progressRing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  knobDot: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: V.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.accentSage,
    zIndex: 20,
    elevation: 20,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.42)',
  },
});
