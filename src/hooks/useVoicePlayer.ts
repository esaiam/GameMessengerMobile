import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setIsAudioActiveAsync } from 'expo-audio';
import { Audio, type AVPlaybackStatus } from 'expo-av';

export function useVoicePlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const playGenRef = useRef(0);
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const activeUriRef = useRef<string | null>(null);
  activeUriRef.current = activeUri;

  const onStatus = useCallback((s: AVPlaybackStatus) => {
    if (!s.isLoaded) return;
    setPlaying(s.isPlaying ?? false);
    setDuration((s.durationMillis ?? 0) / 1000);
    setProgress(
      s.durationMillis && s.durationMillis > 0
        ? (s.positionMillis ?? 0) / s.durationMillis
        : 0
    );
    if (s.didJustFinish) {
      setPlaying(false);
      setProgress(0);
      setActiveUri(null);
      activeUriRef.current = null;
    }
  }, []);

  const play = useCallback(
    async (uri: string) => {
      console.log('[VOICE] play called with uri:', uri);
      try {
        // Деактивируем expo-audio сессию перед воспроизведением через expo-av
        try {
          await setIsAudioActiveAsync(false);
        } catch {}
        await new Promise(r => setTimeout(r, 300));

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: 1, // DO_NOT_MIX = 1
          interruptionModeAndroid: 1, // DO_NOT_MIX = 1
        });

        // Та же дорожка — пауза/возобновление
        if (activeUriRef.current === uri && soundRef.current) {
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

        // Новая дорожка — выгрузить старую
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
          } catch {
            /* ignore */
          }
          soundRef.current = null;
        }

        const gen = ++playGenRef.current;

        setActiveUri(uri);
        activeUriRef.current = uri;
        setProgress(0);

        let sound: Audio.Sound | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: true, progressUpdateIntervalMillis: 100 },
              onStatus
            );
            sound = result.sound;
            break;
          } catch (e: any) {
            console.warn('[useVoicePlayer] createAsync attempt', attempt + 1, 'failed:', e?.message);
            if (attempt < 2) await new Promise(r => setTimeout(r, 200));
          }
        }

        if (!sound) {
          console.warn('[useVoicePlayer] all createAsync attempts failed, aborting');
          setActiveUri(null);
          activeUriRef.current = null;
          return;
        }

        if (gen !== playGenRef.current) {
          try { await sound.unloadAsync(); } catch {}
          return;
        }

        await sound.setVolumeAsync(1.0);
        await sound.setIsMutedAsync(false);
        const status = await sound.getStatusAsync();
        console.log('[VOICE] status after create:', JSON.stringify(status));
        console.log('[VOICE] sound created, playing...');
        soundRef.current = sound;
      } catch (e) {
        console.warn('[useVoicePlayer] error', JSON.stringify(e), e?.message);
      }
    },
    [onStatus]
  );

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
