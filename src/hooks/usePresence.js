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
      const st = typeof ch.presenceState === 'function' ? ch.presenceState() : {};
      const online = new Set();
      Object.entries(st || {}).forEach(([presenceKey, arr]) => {
        if (presenceKey) online.add(presenceKey);
        (arr || []).forEach((p) => {
          if (p?.nickname) online.add(p.nickname);
        });
      });
      const want = String(targetName || '').trim().toLowerCase();
      if (!want) {
        setIsOnline(false);
        return;
      }
      setIsOnline([...online].some((n) => String(n).trim().toLowerCase() === want));
    };

    ch.on('presence', { event: 'sync' }, recompute);
    ch.on('presence', { event: 'join' }, recompute);
    ch.on('presence', { event: 'leave' }, recompute);

    ch.subscribe(async (status, err) => {
      if (__DEV__ && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
        console.warn('[Vault][presence]', `presence-room-${roomId}`, '→', status, err?.message || err || '');
      }
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track({ nickname, at: Date.now() });
        } catch (e) {
          if (__DEV__) console.warn('[Vault][presence] track failed:', e?.message || e);
        }
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
