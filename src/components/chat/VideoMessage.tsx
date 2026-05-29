import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
  PanResponder } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import Svg, { Circle } from 'react-native-svg';
import { File as ExpoFile } from 'expo-file-system';
import { V } from '../../theme';
import { recordFileAccess } from '../../storage/CacheManager';
import {
  VIDEO_FEED_CIRCLE_IDLE,
  VIDEO_FEED_CIRCLE_ACTIVE } from './messageBubbleLayoutConstants';
const IDLE_WARMUP_TEXTURE = require('../../../assets/chat-room-wallpaper.jpg');

interface VideoMessageProps {
  url: string;
  messageId: string;
  activeVideoId: string | null;
  wasActivated: boolean;
  onActivate: (id: string | null) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  /** Optimistic video: upload в Supabase ещё идёт */
  isUploading?: boolean;
}

const CIRCLE_IDLE = VIDEO_FEED_CIRCLE_IDLE;
const CIRCLE_ACTIVE = VIDEO_FEED_CIRCLE_ACTIVE;
const R_IDLE = CIRCLE_IDLE / 2;
const R_ACTIVE = CIRCLE_ACTIVE / 2;
/** Свежий локальный mp4 часто шлёт ложный playToEnd до стабильной длительности — не закрываем UI сразу после старта. */
const PLAY_TO_END_GRACE_MS = 550;
const MEANINGFUL_PROGRESS = { minDur: 0.06, minTime: 0.012 };

/** Кольцо прогресса в viewBox 0…100 — центр линии на краю видеокруга. */
const RING_C = 50;
const RING_STROKE = 1.75;
const RING_R = RING_C - RING_STROKE / 2;
const KNOB_R = 3.25;
/** Центр knob снаружи диска — не пересекается с маской видео. */
const KNOB_ORBIT_R = RING_R + KNOB_R * 0.55;
const RING_CIRC = 2 * Math.PI * RING_R;
const RING_TRACK = 'rgba(255,255,255,0.16)';
const RING_HIT_INNER_RATIO = 0.72;
const SCRUB_SEEK_INTERVAL_MS = 120;

function runOnPlayer(
  player: { status: string } | null | undefined,
  isAllowed: () => boolean,
  op: () => void,
) {
  if (!player || !isAllowed()) return;
  try {
    if (player.status === 'idle' || player.status === 'error') return;
    op();
  } catch {
    /* native player released */
  }
}

function touchToProgress01(locationX: number, locationY: number, width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const angle = Math.atan2(locationY - cy, locationX - cx);
  let p = (angle + Math.PI / 2) / (2 * Math.PI);
  if (p < 0) p += 1;
  return Math.min(1, Math.max(0, p));
}

function isNearRingEdge(locationX: number, locationY: number, width: number, height: number) {
  if (width <= 0 || height <= 0) return false;
  const cx = width / 2;
  const cy = height / 2;
  const dist = Math.hypot(locationX - cx, locationY - cy);
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * RING_HIT_INNER_RATIO;
  return dist >= innerR && dist <= outerR + 14;
}

export default function VideoMessage({ url, messageId, activeVideoId, wasActivated, onActivate, onLongPress, isUploading = false }: VideoMessageProps) {
  const isActive = activeVideoId === messageId;
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  /** Превью из getThumbnailAsync готово — в покое снимаем блюр с миниатюры */
  const [idlePreviewReady, setIdlePreviewReady] = useState(false);
  /** Поток готов к показу — при воспроизведении убираем блюр с VideoView */
  const [streamRenderReady, setStreamRenderReady] = useState(false);
  const [activated, setActivated] = useState(wasActivated);
  const [shouldInitPlayer, setShouldInitPlayer] = useState(wasActivated);
  const [progress01, setProgress01] = useState(0);
  const [isScrubbingUi, setIsScrubbingUi] = useState(false);
  const sizeAnim = useRef(new Animated.Value(CIRCLE_IDLE)).current;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  /** Был ли реальный прогректайм (отсекаем playToEnd при duration≈0 сразу после play). */
  const sawMeaningfulProgressRef = useRef(false);
  const playbackStartedAtRef = useRef(0);
  const durationRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const ringTouchModeRef = useRef<'idle' | 'scrub' | 'tap'>('idle');
  const ringLayoutRef = useRef({ width: CIRCLE_ACTIVE, height: CIRCLE_ACTIVE });
  const scrubTargetProgressRef = useRef(0);
  const lastScrubSeekAtRef = useRef(0);
  const playToEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsActiveRef = useRef(isActive);

  // Флаг готовности к загрузке превью — откладываем на 600ms после монтирования,
  // чтобы не запускать N параллельных нативных декодеров при открытии чата.
  const [shouldLoadThumb, setShouldLoadThumb] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShouldLoadThumb(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    durationRef.current = 0;
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

  const player = useVideoPlayer(shouldInitPlayer || isActive ? url : null, (p) => {
    if (!p) return;
    p.loop = false;
    p.pause();
    p.timeUpdateEventInterval = 0.25;
  });
  const playerRef = useRef(player);
  playerRef.current = player;

  const canUsePlayer = useCallback(() => isActiveRef.current && !!playerRef.current, []);

  const applyProgressFromPlayer = useCallback((currentTime: number, duration: number) => {
    if (isScrubbingRef.current) return;
    if (duration >= MEANINGFUL_PROGRESS.minDur && currentTime >= MEANINGFUL_PROGRESS.minTime) {
      sawMeaningfulProgressRef.current = true;
    }
    if (duration <= 0) return;
    if (duration > 0.05) setStreamRenderReady(true);
    setProgress01(Math.min(1, Math.max(0, currentTime / duration)));
  }, []);

  const beginScrub = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    isScrubbingRef.current = true;
    setIsScrubbingUi(true);
    runOnPlayer(p, canUsePlayer, () => {
      wasPlayingBeforeScrubRef.current = p.playing;
      p.pause();
    });
    lastScrubSeekAtRef.current = 0;
    setStreamRenderReady(true);
  }, [canUsePlayer]);

  const seekToProgress = useCallback((p: number, opts?: { force?: boolean }) => {
    const activePlayer = playerRef.current;
    const duration = durationRef.current > 0 ? durationRef.current : activePlayer?.duration ?? 0;
    if (!activePlayer || duration <= 0 || !canUsePlayer()) return;
    const clamped = Math.min(1, Math.max(0, p));
    durationRef.current = duration;
    scrubTargetProgressRef.current = clamped;
    setProgress01(clamped);

    const targetTime = clamped * duration;
    const applySeek = () => {
      runOnPlayer(activePlayer, canUsePlayer, () => {
        activePlayer.currentTime = targetTime;
      });
    };

    if (!isScrubbingRef.current) {
      applySeek();
      return;
    }

    const now = Date.now();
    if (!opts?.force && now - lastScrubSeekAtRef.current < SCRUB_SEEK_INTERVAL_MS) return;
    lastScrubSeekAtRef.current = now;
    applySeek();
  }, [canUsePlayer]);

  const endScrub = useCallback(() => {
    const p = playerRef.current;
    setIsScrubbingUi(false);
    if (!p) {
      isScrubbingRef.current = false;
      return;
    }
    const duration = durationRef.current > 0 ? durationRef.current : p.duration;
    const targetTime = scrubTargetProgressRef.current * duration;
    runOnPlayer(p, canUsePlayer, () => {
      if (duration > 0 && Math.abs(p.currentTime - targetTime) > 0.08) {
        p.currentTime = targetTime;
      }
      if (wasPlayingBeforeScrubRef.current) {
        p.play();
      }
    });
    isScrubbingRef.current = false;
  }, [canUsePlayer]);

  const handleRingLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      ringLayoutRef.current = { width, height };
    }
  }, []);

  const ringPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isActiveRef.current,
        onMoveShouldSetPanResponder: () => ringTouchModeRef.current === 'scrub',
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const { width, height } = ringLayoutRef.current;
          if (isNearRingEdge(locationX, locationY, width, height)) {
            ringTouchModeRef.current = 'scrub';
            beginScrub();
            seekToProgress(touchToProgress01(locationX, locationY, width, height), { force: true });
            return;
          }
          ringTouchModeRef.current = 'tap';
        },
        onPanResponderMove: (evt) => {
          if (ringTouchModeRef.current !== 'scrub') return;
          const { locationX, locationY } = evt.nativeEvent;
          const { width, height } = ringLayoutRef.current;
          seekToProgress(touchToProgress01(locationX, locationY, width, height));
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (ringTouchModeRef.current === 'scrub') {
            endScrub();
          } else if (
            ringTouchModeRef.current === 'tap' &&
            Math.hypot(gestureState.dx, gestureState.dy) < 8
          ) {
            onActivate(null);
          }
          ringTouchModeRef.current = 'idle';
        },
        onPanResponderTerminate: () => {
          if (ringTouchModeRef.current === 'scrub') endScrub();
          ringTouchModeRef.current = 'idle';
        } }),
    [beginScrub, endScrub, onActivate, seekToProgress],
  );

  // Реагируем на isActive — только на переходах, не при shouldInitPlayer/player refresh.
  useEffect(() => {
    if (isActive && !shouldInitPlayer) setShouldInitPlayer(true);
  }, [isActive, shouldInitPlayer]);

  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isActive;

    if (isActive && !wasActive) {
      if (playToEndTimeoutRef.current !== null) {
        clearTimeout(playToEndTimeoutRef.current);
        playToEndTimeoutRef.current = null;
      }
      sawMeaningfulProgressRef.current = false;
      playbackStartedAtRef.current = 0;
      setActivated(true);
      setProgress01(0);
      setStreamRenderReady(false);
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_ACTIVE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200 }).start();
      return;
    }

    if (!isActive && wasActive) {
      if (isScrubbingRef.current) {
        isScrubbingRef.current = false;
        setIsScrubbingUi(false);
        ringTouchModeRef.current = 'idle';
      }
      sawMeaningfulProgressRef.current = false;
      playbackStartedAtRef.current = 0;
      setStreamRenderReady(false);
      setProgress01(0);
      try {
        const p = playerRef.current;
        if (p) {
          p.pause();
          const dur = p.duration > 0 ? p.duration : durationRef.current;
          if (dur > 0 && p.currentTime >= dur - 0.05) {
            p.currentTime = 0;
          }
        }
      } catch {
        /* ignore */
      }
      Animated.spring(sizeAnim, {
        toValue: CIRCLE_IDLE,
        useNativeDriver: false,
        damping: 18,
        stiffness: 200 }).start();
    }
  }, [isActive, sizeAnim]);

  useEffect(() => {
    if (!player) return;
    if (!isActive) return;
    try {
      player.timeUpdateEventInterval = 0.1;
    } catch {
      /* ignore */
    }
    const subTime = player.addListener('timeUpdate', (payload) => {
      if (!isActiveRef.current || isScrubbingRef.current) return;
      try {
        const duration =
          player.duration > 0
            ? player.duration
            : durationRef.current;
        if (player.duration > 0) durationRef.current = player.duration;
        applyProgressFromPlayer(payload.currentTime, duration);
      } catch {
        /* ignore */
      }
    });
    const subLoad = player.addListener('sourceLoad', (payload) => {
      if (payload.duration > 0) durationRef.current = payload.duration;
    });
    return () => {
      subTime.remove();
      subLoad.remove();
      try {
        player.timeUpdateEventInterval = 0.25;
      } catch {
        /* ignore */
      }
    };
  }, [isActive, player, applyProgressFromPlayer]);

  useEffect(() => {
    if (!player || !isActive) return;

    let alive = true;

    const beginPlay = () => {
      if (!alive || !isActiveRef.current) return;
      const p = playerRef.current;
      if (!p) return;
      try {
        if (p.status !== 'readyToPlay') return;
        if (p.playing) return;
        if (p.duration > 0) durationRef.current = p.duration;
        setStreamRenderReady(true);
        playbackStartedAtRef.current = Date.now();
        sawMeaningfulProgressRef.current = false;
        if (p.currentTime > 0.01) {
          p.currentTime = 0;
        }
        p.play();
      } catch {
        /* native player released */
      }
    };

    const tMount = setTimeout(beginPlay, 32);
    const sub = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') beginPlay();
    });
    const fallback = setTimeout(beginPlay, 600);

    return () => {
      alive = false;
      clearTimeout(tMount);
      clearTimeout(fallback);
      sub.remove();
    };
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playToEnd', () => {
      if (!isActiveRef.current) return;
      const started = playbackStartedAtRef.current;
      const sinceStart = started > 0 ? Date.now() - started : Number.POSITIVE_INFINITY;
      if (sinceStart < PLAY_TO_END_GRACE_MS && !sawMeaningfulProgressRef.current) {
        return;
      }
      if (playToEndTimeoutRef.current !== null) {
        clearTimeout(playToEndTimeoutRef.current);
      }
      playToEndTimeoutRef.current = setTimeout(() => {
        playToEndTimeoutRef.current = null;
        if (!isActiveRef.current) return;
        onActivate(null);
      }, 300);
    });
    return () => {
      sub.remove();
      if (playToEndTimeoutRef.current !== null) {
        clearTimeout(playToEndTimeoutRef.current);
        playToEndTimeoutRef.current = null;
      }
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
    outputRange: [R_IDLE, R_ACTIVE] });

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
        transform: [{ scale: pressed && !isActive ? 1.04 : 1 }] })}
    >
      <Animated.View
        onLayout={handleRingLayout}
        style={{
          width: sizeAnim,
          height: sizeAnim,
          borderRadius,
          overflow: 'visible' }}
      >
        {/* Круговой клип только здесь: у предка VideoView не держим overflow+native-driver scale/opacity — иначе после смены layout (выделение и т.п.) поверхность может не рисоваться. */}
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: V.bgElevated,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: V.border }}
        >
          {/* VideoView всегда в дереве — но скрыт thumbnail пока не активен */}
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

          {isUploading ? (
            <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]} pointerEvents="none">
              <ActivityIndicator size="small" color={V.accentSage} />
            </View>
          ) : null}
        </Animated.View>

        {isActive ? (
          <View
            style={styles.progressRing}
            {...ringPanResponder.panHandlers}
          >
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
                  marginTop: `${-KNOB_R}%` }]}
            />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  videoLayer: {
    zIndex: 1 },
  veilLayer: {
    zIndex: 3 },
  thumbLayer: {
    zIndex: 2 },
  progressRing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible' },
  knobDot: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: V.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.accentSage,
    zIndex: 20,
    elevation: 20 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.42)' } });
