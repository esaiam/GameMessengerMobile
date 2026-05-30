import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { PanResponder } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { File as ExpoFile } from 'expo-file-system';
import { recordFileAccess } from '../storage/CacheManager';
import {
  CIRCLE_ACTIVE,
  MEANINGFUL_PROGRESS,
  PLAY_TO_END_GRACE_MS,
  SCRUB_SEEK_INTERVAL_MS,
} from '../components/chat/videoMessageConstants';
import { isNearRingEdge, runOnPlayer, touchToProgress01 } from '../components/chat/videoMessageGeometry';

export interface UseVideoMessagePlayerParams {
  url: string;
  isActive: boolean;
  wasActivated: boolean;
  /** Закрыть активное видео (playToEnd, tap по кольцу). */
  onCloseActive: () => void;
}

export function useVideoMessagePlayer({
  url,
  isActive,
  wasActivated,
  onCloseActive,
}: UseVideoMessagePlayerParams) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [idlePreviewReady, setIdlePreviewReady] = useState(false);
  const [streamRenderReady, setStreamRenderReady] = useState(false);
  const [activated, setActivated] = useState(wasActivated);
  const [shouldInitPlayer, setShouldInitPlayer] = useState(wasActivated);
  const [progress01, setProgress01] = useState(0);
  const [isScrubbingUi, setIsScrubbingUi] = useState(false);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

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

  const seekToProgress = useCallback(
    (p: number, opts?: { force?: boolean }) => {
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
    },
    [canUsePlayer],
  );

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
            onCloseActive();
          }
          ringTouchModeRef.current = 'idle';
        },
        onPanResponderTerminate: () => {
          if (ringTouchModeRef.current === 'scrub') endScrub();
          ringTouchModeRef.current = 'idle';
        },
      }),
    [beginScrub, endScrub, onCloseActive, seekToProgress],
  );

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
    }
  }, [isActive]);

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
        const duration = player.duration > 0 ? player.duration : durationRef.current;
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
        onCloseActive();
      }, 300);
    });
    return () => {
      sub.remove();
      if (playToEndTimeoutRef.current !== null) {
        clearTimeout(playToEndTimeoutRef.current);
        playToEndTimeoutRef.current = null;
      }
    };
  }, [player, onCloseActive]);

  return {
    player,
    activated,
    thumbUri,
    idlePreviewReady,
    streamRenderReady,
    progress01,
    isScrubbingUi,
    handleRingLayout,
    ringPanHandlers: ringPanResponder.panHandlers,
  };
}
