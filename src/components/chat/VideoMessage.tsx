import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Svg, { Circle } from 'react-native-svg';
import { File as ExpoFile } from 'expo-file-system';
import { V } from '../../theme';
import { recordFileAccess } from '../../storage/CacheManager';
const IDLE_WARMUP_TEXTURE = require('../../../assets/chat-room-wallpaper.jpg');

interface VideoMessageProps {
  url: string;
  messageId: string;
  activeVideoId: string | null;
  wasActivated: boolean;
  onActivate: (id: string | null) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
}

const CIRCLE_IDLE = 200;
const CIRCLE_ACTIVE = 280;
const R_IDLE = CIRCLE_IDLE / 2;
const R_ACTIVE = CIRCLE_ACTIVE / 2;
/** Свежий локальный mp4 часто шлёт ложный playToEnd до стабильной длительности — не закрываем UI сразу после старта. */
const PLAY_TO_END_GRACE_MS = 550;
const MEANINGFUL_PROGRESS = { minDur: 0.06, minTime: 0.012 };

export default function VideoMessage({ url, messageId, activeVideoId, wasActivated, onActivate, onLongPress }: VideoMessageProps) {
  const isActive = activeVideoId === messageId;
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  /** Превью из getThumbnailAsync готово — в покое снимаем блюр с миниатюры */
  const [idlePreviewReady, setIdlePreviewReady] = useState(false);
  /** Поток готов к показу — при воспроизведении убираем блюр с VideoView */
  const [streamRenderReady, setStreamRenderReady] = useState(false);
  const [activated, setActivated] = useState(wasActivated);
  const [shouldInitPlayer, setShouldInitPlayer] = useState(wasActivated);
  const [progress01, setProgress01] = useState(0);
  const sizeAnim = useRef(new Animated.Value(CIRCLE_IDLE)).current;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  /** Был ли реальный прогректайм (отсекаем playToEnd при duration≈0 сразу после play). */
  const sawMeaningfulProgressRef = useRef(false);
  const playbackStartedAtRef = useRef(0);

  // Флаг готовности к загрузке превью — откладываем на 600ms после монтирования,
  // чтобы не запускать N параллельных нативных декодеров при открытии чата.
  const [shouldLoadThumb, setShouldLoadThumb] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShouldLoadThumb(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setIdlePreviewReady(false);
    setThumbUri(null);
  }, [url]);

  useEffect(() => {
    if (!shouldLoadThumb) return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(url, { time: 0 })
      .then(({ uri }) => {
        if (!cancelled) {
          setThumbUri(uri);
          setIdlePreviewReady(true);
          try {
            const f = new ExpoFile(uri);
            const sz = typeof f.size === 'number' && Number.isFinite(f.size) ? f.size : 0;
            recordFileAccess(uri, sz).catch(() => {});
          } catch {
            recordFileAccess(uri, 0).catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!cancelled) setIdlePreviewReady(true);
      });
    return () => {
      cancelled = true;
    };
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
      sawMeaningfulProgressRef.current = false;
      playbackStartedAtRef.current = 0;
      setStreamRenderReady(false);
      setActivated(true);
      setProgress01(0);
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_ACTIVE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200,
      }).start();
    } else {
      sawMeaningfulProgressRef.current = false;
      playbackStartedAtRef.current = 0;
      setStreamRenderReady(false);
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
    try {
      player.timeUpdateEventInterval = 0.1;
    } catch {
      /* ignore */
    }
    const sub = player.addListener('timeUpdate', (e: any) => {
      const currentTime = typeof e?.currentTime === 'number' ? e.currentTime : 0;
      const duration = typeof e?.duration === 'number' ? e.duration : 0;
      if (
        duration >= MEANINGFUL_PROGRESS.minDur &&
        currentTime >= MEANINGFUL_PROGRESS.minTime
      ) {
        sawMeaningfulProgressRef.current = true;
      }
      if (duration <= 0) return;
      if (duration > 0.05) setStreamRenderReady(true);
      const p = Math.min(1, Math.max(0, currentTime / duration));
      setProgress01(p);
    });
    return () => {
      sub.remove();
      try {
        player.timeUpdateEventInterval = 0.25;
      } catch {
        /* ignore */
      }
    };
  }, [isActive, player]);

  useEffect(() => {
    if (!isActive || !player) return;
    const t = setTimeout(() => setStreamRenderReady(true), 2800);
    return () => clearTimeout(t);
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;
    if (!isActive) return;

    let started = false;

    const sub = player.addListener('statusChange', (status: any) => {
      if (started) return;
      if (status?.isLoaded || status?.playableDuration > 0) {
        started = true;
        setStreamRenderReady(true);
        playbackStartedAtRef.current = Date.now();
        player.replay();
        player.play();
      }
    });

    const fallback = setTimeout(() => {
      if (!started) {
        started = true;
        setStreamRenderReady(true);
        playbackStartedAtRef.current = Date.now();
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
    let t: ReturnType<typeof setTimeout> | null = null;
    const sub = player.addListener('playToEnd', () => {
      if (!isActiveRef.current) return;
      const started = playbackStartedAtRef.current;
      const sinceStart = started > 0 ? Date.now() - started : Number.POSITIVE_INFINITY;
      if (sinceStart < PLAY_TO_END_GRACE_MS && !sawMeaningfulProgressRef.current) {
        return;
      }
      t = setTimeout(() => {
        if (!isActiveRef.current) return;
        onActivate(null);
      }, 300);
    });
    return () => {
      sub.remove();
      if (t !== null) clearTimeout(t);
    };
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

  const showIdleLoadingVeil = !isActive && !idlePreviewReady;
  const showActiveStreamVeil = isActive && !streamRenderReady;
  const veilPosterSource =
    showActiveStreamVeil && thumbUri ? { uri: thumbUri } : IDLE_WARMUP_TEXTURE;

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
            style={[StyleSheet.absoluteFill, styles.videoLayer]}
            contentFit="cover"
            nativeControls={false}
            {...(Platform.OS === 'android' ? { surfaceType: 'textureView' } : {})}
          />
        )}

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

        {/* Миниатюра в покое после загрузки превью */}
        {!isActive && idlePreviewReady && thumbUri && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.thumbLayer]}>
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
    zIndex: 5,
  },
});
