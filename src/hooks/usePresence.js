import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function usePresence({ roomId, nickname, targetName, skip }) {
  const [isOnline, setIsOnline] = useState(() => skip === true);

  useEffect(() => {
    if (skip) {
      setIsOnline(true);
      return;
    }
    if (!roomId || !nickname || !targetName) {
      setIsOnline(false);
      return;
    }

    const ch = supabase.channel(`presence-room-${roomId}`, {
      config: { presence: { key: nickname } },
    });

    const recompute = () => {
      const st = ch.presenceState?.() || {};
      const online = new Set();
      Object.values(st).forEach((arr) => {
        (arr || []).forEach((p) => {
          if (p?.nickname) online.add(p.nickname);
        });
      });
      setIsOnline(online.has(targetName));
    };

    ch.on('presence', { event: 'sync' }, recompute);
    ch.on('presence', { event: 'join' }, recompute);
    ch.on('presence', { event: 'leave' }, recompute);

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track({ nickname, at: Date.now() });
        } catch {}
        recompute();
      }
    });

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [roomId, nickname, targetName, skip]);

  return isOnline;
}
