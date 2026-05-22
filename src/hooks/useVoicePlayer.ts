import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setIsAudioActiveAsync } from 'expo-audio';
import { Audio, type AVPlaybackStatus } from 'expo-av';

export function useVoicePlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  /** URI экземпляра, сейчас в `soundRef` (для «та же дорожка» до любых await). */
  const loadedUriRef = useRef<string | null>(null);
  /** Инкремент при старте новой дорожки — глушит onStatus от предыдущего Sound. */
  const playbackGenRef = useRef(0);

  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const activeUriRef = useRef<string | null>(null);
  activeUriRef.current = activeUri;

  const play = useCallback(async (uri: string) => {
    if (__DEV__) console.log('[VOICE] play called with uri:', uri);
    try {
      const sameLoaded = soundRef.current != null && loadedUriRef.current === uri;
      if (!sameLoaded) {
        playbackGenRef.current += 1;
        setPlaying(false);
        setProgress(0);
        setDuration(0);
      }

      try {
        await setIsAudioActiveAsync(false);
      } catch {}
      await new Promise((r) => setTimeout(r, 300));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      if (soundRef.current && loadedUriRef.current === uri) {
        const s = await soundRef.current.getStatusAsync();
        if (!s.isLoaded) return;
        if (s.isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          if (s.durationMillis && s.positionMillis >= s.durationMillis - 100) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
        }
        return;
      }

      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {
          /* ignore */
        }
        soundRef.current = null;
        loadedUriRef.current = null;
      }

      const bindGen = playbackGenRef.current;

      const onStatusForThisSound = (s: AVPlaybackStatus) => {
        if (bindGen !== playbackGenRef.current) return;
        if (!s.isLoaded) return;
        setPlaying(s.isPlaying ?? false);
        setDuration((s.durationMillis ?? 0) / 1000);
        setProgress(
          s.durationMillis && s.durationMillis > 0
            ? (s.positionMillis ?? 0) / s.durationMillis
            : 0
        );
        if (s.didJustFinish) {
          if (bindGen !== playbackGenRef.current) return;
          setPlaying(false);
          setProgress(0);
          setActiveUri(null);
          activeUriRef.current = null;
        }
      };

      setActiveUri(uri);
      activeUriRef.current = uri;

      let sound: Audio.Sound | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true, progressUpdateIntervalMillis: 300 },
            onStatusForThisSound
          );
          sound = result.sound;
          break;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (__DEV__) console.warn('[useVoicePlayer] createAsync attempt', attempt + 1, 'failed:', msg);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (!sound) {
        if (__DEV__) console.warn('[useVoicePlayer] all createAsync attempts failed, aborting');
        setActiveUri(null);
        activeUriRef.current = null;
        return;
      }

      if (bindGen !== playbackGenRef.current) {
        try {
          await sound.unloadAsync();
        } catch {
          /* ignore */
        }
        return;
      }

      await sound.setVolumeAsync(1.0);
      await sound.setIsMutedAsync(false);
      const status = await sound.getStatusAsync();
      if (__DEV__) console.log('[VOICE] status after create:', JSON.stringify(status));
      if (__DEV__) console.log('[VOICE] sound created, playing...');
      soundRef.current = sound;
      loadedUriRef.current = uri;
    } catch (e) {
      if (__DEV__) console.warn('[useVoicePlayer] error', JSON.stringify(e), e instanceof Error ? e.message : e);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
    } catch {
      /* ignore */
    }
    setPlaying(false);
    setActiveUri(null);
    activeUriRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const currentTime = progress * duration;
  const status = useMemo(
    () => ({
      playing,
      duration,
      currentTime,
      isLoaded: !!soundRef.current,
      playbackState: playing ? 'playing' : ('paused' as const),
    }),
    [playing, duration, currentTime]
  );

  return { play, pause, activeUri, status };
}
