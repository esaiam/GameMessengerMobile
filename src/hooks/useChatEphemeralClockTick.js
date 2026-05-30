import { useEffect, useRef, useState } from 'react';

function buildEphemeralWatchSig(messages) {
  let sig = '';
  for (const m of messages) {
    if (m.expires_at) {
      sig += m.id;
      sig += ':';
      sig += m.expires_at;
      sig += ';';
    }
  }
  return sig;
}

/**
 * 1 c тик только пока в ленте есть неистёкшие эфемерные сообщения (без глобального интервала).
 */
export function useChatEphemeralClockTick(messages, renderPausedRef) {
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [ephemeralClockTick, setEphemeralClockTick] = useState(0);
  const ephemeralWatchSig = buildEphemeralWatchSig(messages);

  useEffect(() => {
    const hasUnexpiredEphemeral = () =>
      messagesRef.current.some(
        (m) => m.expires_at && new Date(m.expires_at).getTime() > Date.now(),
      );
    if (!hasUnexpiredEphemeral()) return undefined;
    const id = setInterval(() => {
      if (renderPausedRef?.current) return;
      setEphemeralClockTick((n) => n + 1);
      if (!hasUnexpiredEphemeral()) {
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [ephemeralWatchSig, renderPausedRef]);

  return ephemeralClockTick;
}
