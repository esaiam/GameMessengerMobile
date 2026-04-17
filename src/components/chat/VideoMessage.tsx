import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Svg, { Circle } from 'react-native-svg';
import { V } from '../../theme';

interface VideoMessageProps {
  url: string;
  messageId: string;
  activeVideoId: string | null;
  wasActivated: boolean;
  onActivate: (id: string | null) => void;
  onLongPress?: () => void;
}

const CIRCLE_IDLE = 200;
const CIRCLE_ACTIVE = 280;
const R_IDLE = CIRCLE_IDLE / 2;
const R_ACTIVE = CIRCLE_ACTIVE / 2;

export default function VideoMessage({ url, messageId, activeVideoId, wasActivated, onActivate, onLongPress }: VideoMessageProps) {
  const isActive = activeVideoId === messageId;
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [activated, setActivated] = useState(wasActivated);
  const [shouldInitPlayer, setShouldInitPlayer] = useState(wasActivated);
  const [progress01, setProgress01] = useState(0);
  const sizeAnim = useRef(new Animated.Value(CIRCLE_IDLE)).current;

  // Флаг готовности к загрузке превью — откладываем на 600ms после монтирования,
  // чтобы не запускать N параллельных нативных декодеров при открытии чата.
  const [shouldLoadThumb, setShouldLoadThumb] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShouldLoadThumb(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!shouldLoadThumb) return;
    VideoThumbnails.getThumbnailAsync(url, { time: 0 })
      .then(({ uri }) => setThumbUri(uri))
      .catch(() => {});
  }, [shouldLoadThumb, url]);

  // Плеер создаётся после первой активации (или сразу, если wasActivated)
  const player = useVideoPlayer(shouldInitPlayer ? url : null, (p) => {
    if (!p) return;
    p.loop = false;
    p.pause();
    p.timeUpdateEventInterval = 0.25;
  });

  // Реагируем на isActive
  useEffect(() => {
    if (isActive && !shouldInitPlayer) setShouldInitPlayer(true);
    if (isActive) {
      setActivated(true);
      setProgress01(0);
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_ACTIVE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200,
      }).start();
    } else {
      if (player) player.pause();
      setProgress01(0);
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_IDLE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200,
      }).start();
    }
  }, [isActive, player, sizeAnim, shouldInitPlayer]);

  useEffect(() => {
    if (!player) return;
    if (!isActive) return;
    const sub = player.addListener('timeUpdate', (e: any) => {
      const currentTime = typeof e?.currentTime === 'number' ? e.currentTime : 0;
      const duration = typeof e?.duration === 'number' ? e.duration : 0;
      if (duration <= 0) return;
      const p = Math.min(1, Math.max(0, currentTime / duration));
      setProgress01(p);
    });
    return () => sub.remove();
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;
    if (!isActive) return;

    let started = false;

    const sub = player.addListener('statusChange', (status: any) => {
      if (started) return;
      if (status?.isLoaded || status?.playableDuration > 0) {
        started = true;
        player.replay();
        player.play();
      }
    });

    const fallback = setTimeout(() => {
      if (!started) {
        started = true;
        try { player.replay(); player.play(); } catch {}
      }
    }, 500);

    return () => {
      sub.remove();
      clearTimeout(fallback);
    };
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playToEnd', () => {
      onActivate(null);
    });
    return () => sub.remove();
  }, [player, onActivate]);

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

  return (
    <Pressable
      onPress={togglePlay}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityLabel={isActive ? 'Пауза' : 'Воспроизвести видео'}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 1.04 : 1 }],
      })}
    >
      {/* Круговой клип только здесь: у предка VideoView не держим overflow+native-driver scale/opacity — иначе после смены layout (выделение и т.п.) поверхность может не рисоваться. */}
      <Animated.View
        style={{
          width: sizeAnim,
          height: sizeAnim,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: V.bgElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: V.border,
        }}
      >
        {isActive && (
          <View style={styles.progressRing} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r="46"
                stroke={V.border}
                strokeWidth="3"
                fill="transparent"
              />
              <Circle
                cx="50"
                cy="50"
                r="46"
                stroke={V.accentSage}
                strokeWidth="3"
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 46}
                strokeDashoffset={(1 - Math.min(1, Math.max(0, progress01))) * (2 * Math.PI * 46)}
                transform="rotate(-90 50 50)"
              />
            </Svg>
          </View>
        )}

        {/* VideoView всегда в дереве — но скрыт thumbnail пока не активен */}
        {activated && (
          <VideoView
            pointerEvents="none"
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            {...(Platform.OS === 'android' ? { surfaceType: 'textureView' } : {})}
          />
        )}

        {/* Thumbnail поверх пока не активен */}
        {!isActive && thumbUri && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.Image
              source={{ uri: thumbUri }}
              style={[StyleSheet.absoluteFill, { borderRadius }]}
              resizeMode="cover"
            />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressRing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
});
