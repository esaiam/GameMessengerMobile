import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import { setAudioModeAsync } from '../utils/audioMode';

type StatusSub = { remove: () => void };

function detachPlayer(player: AudioPlayer | null, sub: StatusSub | null) {
  try {
    sub?.remove();
  } catch {
    /* ignore */
  }
  if (!player) return;
  try {
    if (player.playing) {
      player.pause();
    }
  } catch {
    /* ignore */
  }
  try {
    player.remove();
  } catch {
    /* ignore */
  }
}

function isRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

/** Ждём загрузки file:// / https перед play (expo-audio не auto-play как expo-av). */
function waitUntilLoaded(player: AudioPlayer, timeoutMs = 10000): Promise<boolean> {
  if (player.isLoaded) return Promise.resolve(true);
  return new Promise((resolve) => {
    let sub: StatusSub | null = null;
    const timer = setTimeout(() => {
      try {
        sub?.remove();
      } catch {
        /* ignore */
      }
      resolve(false);
    }, timeoutMs);
    sub = player.addListener('playbackStatusUpdate', (status) => {
      if (!status.isLoaded) return;
      clearTimeout(timer);
      try {
        sub?.remove();
      } catch {
        /* ignore */
      }
      resolve(true);
    });
  });
}

export function useVoicePlayer() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const statusSubRef = useRef<StatusSub | null>(null);
  const loadedUriRef = useRef<string | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  const playbackGenRef = useRef(0);

  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const activeUriRef = useRef<string | null>(null);
  activeUriRef.current = activeUri;

  const bindStatusListener = useCallback((player: AudioPlayer, bindGen: number) => {
    statusSubRef.current?.remove();
    statusSubRef.current = player.addListener('playbackStatusUpdate', (status) => {
      if (bindGen !== playbackGenRef.current) return;
      if (!status.isLoaded) return;
      setPlaying(status.playing ?? false);
      const dur = status.duration ?? 0;
      setDuration(dur);
      setProgress(dur > 0 ? (status.currentTime ?? 0) / dur : 0);
      if (status.didJustFinish) {
        if (bindGen !== playbackGenRef.current) return;
        setPlaying(false);
        setProgress(0);
        activeMessageIdRef.current = null;
        setActiveUri(null);
        activeUriRef.current = null;
      }
    });
  }, []);

  const ensurePlaybackMode = useCallback(async () => {
    await setIsAudioActiveAsync(true);
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'doNotMix',
    });
  }, []);

  const stopPlaybackSync = useCallback(() => {
    playbackGenRef.current += 1;
    detachPlayer(playerRef.current, statusSubRef.current);
    playerRef.current = null;
    statusSubRef.current = null;
    loadedUriRef.current = null;
    activeMessageIdRef.current = null;
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setActiveUri(null);
    activeUriRef.current = null;
  }, []);

  const play = useCallback(
    async (uri: string, messageId?: string | null) => {
      if (__DEV__) console.log('[VOICE] play called with uri:', uri, 'messageId:', messageId);
      try {
        const sameSession =
          messageId != null &&
          messageId === activeMessageIdRef.current &&
          playerRef.current != null &&
          loadedUriRef.current === uri;

        if (sameSession) {
          await ensurePlaybackMode();
          const p = playerRef.current;
          if (!p) return;
          if (p.playing) {
            p.pause();
            setPlaying(false);
          } else {
            const dur = p.duration ?? 0;
            if (dur > 0 && (p.currentTime ?? 0) >= dur - 0.1) {
              await p.seekTo(0);
            }
            p.play();
          }
          return;
        }

        stopPlaybackSync();

        const bindGen = playbackGenRef.current;
        activeMessageIdRef.current = messageId ?? null;
        setActiveUri(uri);
        activeUriRef.current = uri;

        await ensurePlaybackMode();

        if (bindGen !== playbackGenRef.current) return;

        let player: AudioPlayer | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            player = createAudioPlayer(
              { uri },
              {
                downloadFirst: isRemoteUri(uri),
                updateInterval: 300,
              },
            );
            break;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (__DEV__) {
              console.warn('[useVoicePlayer] createAudioPlayer attempt', attempt + 1, 'failed:', msg);
            }
            if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
          }
        }

        if (!player) {
          if (__DEV__) console.warn('[useVoicePlayer] all create attempts failed, aborting');
          activeMessageIdRef.current = null;
          setActiveUri(null);
          activeUriRef.current = null;
          return;
        }

        if (bindGen !== playbackGenRef.current) {
          detachPlayer(player, null);
          return;
        }

        player.volume = 1;
        player.muted = false;
        bindStatusListener(player, bindGen);
        playerRef.current = player;
        loadedUriRef.current = uri;

        const loaded = await waitUntilLoaded(player);
        if (bindGen !== playbackGenRef.current) {
          detachPlayer(player, statusSubRef.current);
          playerRef.current = null;
          statusSubRef.current = null;
          loadedUriRef.current = null;
          return;
        }
        if (!loaded) {
          if (__DEV__) console.warn('[useVoicePlayer] load timeout');
          activeMessageIdRef.current = null;
          setActiveUri(null);
          activeUriRef.current = null;
          return;
        }

        player.play();
        if (__DEV__) console.log('[VOICE] player playing');
      } catch (e) {
        if (__DEV__) {
          console.warn('[useVoicePlayer] error', e instanceof Error ? e.message : e);
        }
      }
    },
    [bindStatusListener, ensurePlaybackMode, stopPlaybackSync],
  );

  const pause = useCallback(async () => {
    stopPlaybackSync();
  }, [stopPlaybackSync]);

  useEffect(() => {
    return () => {
      detachPlayer(playerRef.current, statusSubRef.current);
      playerRef.current = null;
      statusSubRef.current = null;
    };
  }, []);

  const currentTime = progress * duration;
  const status = useMemo(
    () => ({
      playing,
      duration,
      currentTime,
      isLoaded: !!playerRef.current,
      playbackState: playing ? 'playing' : ('paused' as const),
    }),
    [playing, duration, currentTime],
  );

  return { play, pause, activeUri, status };
}
