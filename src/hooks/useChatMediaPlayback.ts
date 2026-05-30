import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseChatMediaPlaybackParams {
  playVoice: (uri: string, messageId?: string | null) => void | Promise<void>;
  pauseVoice: () => void;
  activeVoiceUri: string | null;
  roomId?: string | null;
}

export function useChatMediaPlayback({
  playVoice,
  pauseVoice,
  activeVoiceUri,
  roomId,
}: UseChatMediaPlaybackParams) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVoiceMessageId, setActiveVoiceMessageId] = useState<string | null>(null);
  const activatedVideoIds = useRef(new Set<string>());

  useEffect(() => {
    if (!activeVoiceUri) setActiveVoiceMessageId(null);
  }, [activeVoiceUri]);

  useEffect(() => {
    pauseVoice();
    setActiveVideoId(null);
  }, [roomId, pauseVoice]);

  const stopVideo = useCallback(() => {
    setActiveVideoId(null);
  }, []);

  const playVoiceMessage = useCallback(
    (uri: string, messageId: string) => {
      setActiveVideoId(null);
      setActiveVoiceMessageId(messageId);
      void playVoice(uri, messageId);
    },
    [playVoice],
  );

  const activateVideo = useCallback(
    (id: string | null) => {
      if (id) {
        pauseVoice();
        activatedVideoIds.current.add(id);
      }
      setActiveVideoId(id);
    },
    [pauseVoice],
  );

  return {
    activeVideoId,
    activeVoiceMessageId,
    activatedVideoIds,
    setActiveVideoId,
    playVoiceMessage,
    activateVideo,
    stopVideo,
  };
}
