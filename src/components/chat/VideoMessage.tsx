import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Pressable, Animated } from 'react-native';
import {
  CIRCLE_IDLE,
  CIRCLE_ACTIVE,
  R_IDLE,
  R_ACTIVE,
  IDLE_WARMUP_TEXTURE,
} from './videoMessageConstants';
import type { VideoMessageProps } from './videoMessageTypes';
import { useVideoMessagePlayer } from '../../hooks/useVideoMessagePlayer';
import VideoMessageCircle from './VideoMessageCircle';
import VideoProgressRing from './VideoProgressRing';

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
    wasEverActive,
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
  const showVeil = showIdleLoadingVeil || showActiveStreamVeil;
  const veilPosterSource =
    showActiveStreamVeil && thumbUri ? { uri: thumbUri } : IDLE_WARMUP_TEXTURE;

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
        <VideoMessageCircle
          player={player}
          showVideo={(wasEverActive || isActive) && !!player}
          borderRadius={borderRadius}
          showVeil={showVeil}
          veilPosterSource={veilPosterSource}
          showThumb={!isActive && idlePreviewReady && !!thumbUri}
          thumbUri={thumbUri}
          isUploading={isUploading}
        />

        {isActive ? (
          <VideoProgressRing progress01={progress01} panHandlers={ringPanHandlers} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
