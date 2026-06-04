import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import {
  ARIA_CONTACT,
  ARIA_MESSAGE_TYPING,
  ariaDbRoleToApiRole,
  buildAriaRequestHistory,
  checkAriaHealth,
  createAriaMessageBaseRow,
  fetchAriaPendingMessages,
  getAriaSeedMessages,
  postAriaMessage,
  trimAriaDisplayMessages,
  ARIA_CHAT_MAX_STORED_MESSAGES,
} from '../lib/aria';
import { setAudioModeAsync } from '../utils/audioMode';

const ARIA_REPLY_VOLUME = 0.3;
const ARIA_MESSAGE_RECEIVED_MP3 = require('../assets/sounds/message_received.mp3');

/** Удаляет в БД всё старше последних N сообщений пользователя. */
async function pruneAriaMessagesDb(userId) {
  if (!userId) return;
  try {
    const { data, error } = await supabase
      .from('aria_messages')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data) || data.length <= ARIA_CHAT_MAX_STORED_MESSAGES) {
      return;
    }
    const staleIds = data.slice(ARIA_CHAT_MAX_STORED_MESSAGES).map((row) => row.id);
    if (staleIds.length > 0) {
      await supabase.from('aria_messages').delete().in('id', staleIds);
    }
  } catch {
    /* не блокируем UI */
  }
}

/** Строка из `aria_messages` → формат ленты Chat. */
function ariaMessagesFromDbRows(rows, nickname) {
  return rows.map((row) => {
    const baseRow = createAriaMessageBaseRow();
    const created_at = row.created_at || new Date().toISOString();
    const isUser = row.role === 'user';
    const aria_api_role = ariaDbRoleToApiRole(row.role);
    return {
      ...baseRow,
      id: `aria-db-${row.id}`,
      player_name: isUser ? nickname : ARIA_CONTACT.display_name,
      text: typeof row.text === 'string' ? row.text : '',
      created_at,
      read_at: created_at,
      message_type: 'text',
      aria_api_role,
    };
  });
}

/**
 * Сессия Aria: история, health, send, clear, pending push, звук ответа.
 * @param {boolean} enabled — `isAriaChat` с экрана
 * @param {string | undefined} nickname — handle из route
 */
export function useAriaChatSession(enabled, nickname) {
  const [ariaMessages, setAriaMessages] = useState(() =>
    enabled ? getAriaSeedMessages() : [],
  );
  const ariaMessagesRef = useRef(ariaMessages);
  ariaMessagesRef.current = ariaMessages;

  const ariaTypingSeqRef = useRef(0);

  const ariaReplyModeReadyRef = useRef(false);
  const ariaReplyPlayerRef = useRef(null);
  const ariaReplyPlayerCreatingRef = useRef(null);
  const ariaReplyFallbackPlayerRef = useRef(null);

  /** null = ещё резолвим; string (в т.ч. '') = можно грузить историю */
  const [ariaResolvedNickname, setAriaResolvedNickname] = useState(null);
  const [ariaOnline, setAriaOnline] = useState(null);

  const ensureAriaReplyAudioMode = useCallback(async () => {
    if (ariaReplyModeReadyRef.current) return;
    await setIsAudioActiveAsync(true);
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
    ariaReplyModeReadyRef.current = true;
  }, []);

  const ensureAriaReplyPlayer = useCallback(async () => {
    if (ariaReplyPlayerRef.current) return;
    if (ariaReplyPlayerCreatingRef.current) {
      await ariaReplyPlayerCreatingRef.current;
      return;
    }
    ariaReplyPlayerCreatingRef.current = (async () => {
      await ensureAriaReplyAudioMode();
      try {
        ariaReplyPlayerRef.current = createAudioPlayer(ARIA_MESSAGE_RECEIVED_MP3, {
          downloadFirst: true,
          keepAudioSessionActive: false,
        });
      } catch {
        ariaReplyPlayerRef.current = null;
      }
    })();
    try {
      await ariaReplyPlayerCreatingRef.current;
    } finally {
      ariaReplyPlayerCreatingRef.current = null;
    }
  }, [ensureAriaReplyAudioMode]);

  const playAriaReplySound = useCallback(async () => {
    try {
      await ensureAriaReplyPlayer();
      if (ariaReplyPlayerRef.current) {
        ariaReplyPlayerRef.current.volume = ARIA_REPLY_VOLUME;
        await ariaReplyPlayerRef.current.seekTo(0);
        ariaReplyPlayerRef.current.play();
        return;
      }
    } catch {
      ariaReplyPlayerRef.current = null;
    }
    try {
      await ensureAriaReplyAudioMode();
      if (ariaReplyFallbackPlayerRef.current) {
        try {
          ariaReplyFallbackPlayerRef.current.remove();
        } catch {}
        ariaReplyFallbackPlayerRef.current = null;
      }
      const fallback = createAudioPlayer(ARIA_MESSAGE_RECEIVED_MP3, {
        downloadFirst: true,
        keepAudioSessionActive: false,
      });
      ariaReplyFallbackPlayerRef.current = fallback;
      fallback.volume = ARIA_REPLY_VOLUME;
      const sub = fallback.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) return;
        try {
          sub.remove();
        } catch {}
        try {
          fallback.remove();
        } catch {}
        if (ariaReplyFallbackPlayerRef.current === fallback) {
          ariaReplyFallbackPlayerRef.current = null;
        }
      });
      await fallback.seekTo(0);
      fallback.play();
    } catch {}
  }, [ensureAriaReplyPlayer, ensureAriaReplyAudioMode]);

  useEffect(() => {
    if (!enabled) return undefined;
    return () => {
      try {
        ariaReplyPlayerRef.current?.release?.();
      } catch {}
      ariaReplyPlayerRef.current = null;
      ariaReplyModeReadyRef.current = false;
      try {
        ariaReplyFallbackPlayerRef.current?.remove?.();
      } catch {}
      ariaReplyFallbackPlayerRef.current = null;
    };
  }, [enabled]);

  /** Перед обновлением ленты убирает предыдущий typing-row. */
  const setAriaMessagesForChat = useCallback((update) => {
    setAriaMessages((prev) => {
      if (typeof update !== 'function') {
        return trimAriaDisplayMessages(update);
      }
      const prevSansTyping = prev.filter(
        (m) => !(m.message_type === ARIA_MESSAGE_TYPING || m.isTyping),
      );
      return trimAriaDisplayMessages(update(prevSansTyping));
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAriaResolvedNickname(null);
      setAriaOnline(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const fromRoute = typeof nickname === 'string' && nickname.trim() ? nickname.trim() : null;
      if (fromRoute) {
        if (!cancelled) setAriaResolvedNickname(fromRoute);
        return;
      }
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authErr) {
          setAriaResolvedNickname('');
          return;
        }
        const user_id = auth?.user?.id;
        if (!user_id) {
          setAriaResolvedNickname('');
          return;
        }
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('handle')
          .eq('id', user_id)
          .maybeSingle();
        if (cancelled) return;
        if (profErr) {
          setAriaResolvedNickname('');
          return;
        }
        const h = typeof profile?.handle === 'string' ? profile.handle.trim() : '';
        setAriaResolvedNickname(h);
      } catch {
        if (!cancelled) setAriaResolvedNickname('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, nickname]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (ariaResolvedNickname === null) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user_id = auth?.user?.id;
        if (!user_id || cancelled) return;

        const { data, error } = await supabase
          .from('aria_messages')
          .select('id, role, text, created_at')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(ARIA_CHAT_MAX_STORED_MESSAGES);

        if (cancelled) return;
        if (error) throw error;

        void pruneAriaMessagesDb(user_id);

        const rows = Array.isArray(data) ? [...data].reverse() : [];
        if (rows.length > 0) {
          setAriaMessages(
            trimAriaDisplayMessages(ariaMessagesFromDbRows(rows, ariaResolvedNickname)),
          );
        }
      } catch {
        /* оставляем приветствие getAriaSeedMessages */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, ariaResolvedNickname]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 8000);
    setAriaOnline(null);
    (async () => {
      const ok = await checkAriaHealth(ac.signal);
      clearTimeout(timeoutId);
      if (!cancelled) setAriaOnline(ok);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      try {
        ac.abort();
      } catch {}
    };
  }, [enabled]);

  const sendToAria = useCallback(
    async (text, options = {}) => {
      if (!enabled) return;
      const aria_voice_message = !!options.aria_voice_message;
      const skipOptimisticUserTyping = options.skipOptimisticUserTyping === true;
      const trimmed = text.trim();
      if (!trimmed) return;

      const typingId = `aria-typing-${Date.now()}-${ariaTypingSeqRef.current++}`;
      const displayNickname =
        ariaResolvedNickname !== null
          ? ariaResolvedNickname
          : typeof nickname === 'string'
            ? nickname
            : '';

      const baseRow = createAriaMessageBaseRow();

      const history = buildAriaRequestHistory(
        ariaMessagesRef.current,
        skipOptimisticUserTyping ? { lastUserTextOverride: trimmed } : {},
      );

      if (!skipOptimisticUserTyping) {
        const userMsgId = `aria-user-${Date.now()}`;
        const now = new Date().toISOString();
        const userRow = {
          ...baseRow,
          id: userMsgId,
          player_name: displayNickname,
          text: trimmed,
          created_at: now,
          read_at: now,
          message_type: 'text',
          aria_api_role: 'user',
          ...(aria_voice_message ? { aria_voice_message: true } : {}),
        };
        const typingRow = {
          ...baseRow,
          id: typingId,
          player_name: ARIA_CONTACT.display_name,
          text: '',
          created_at: now,
          read_at: null,
          message_type: ARIA_MESSAGE_TYPING,
          isTyping: true,
        };
        setAriaMessagesForChat((prev) => [...prev, userRow, typingRow]);
      }

      const stripTyping = (prev) => prev.filter((m) => m.id !== typingId);

      void (async () => {
        try {
          const { data: auth, error: authErr } = await supabase.auth.getUser();
          if (authErr) throw authErr;
          const user_id = auth?.user?.id;
          if (!user_id) throw new Error('no_user');

          try {
            await supabase.from('aria_messages').insert({
              user_id,
              role: 'user',
              text: trimmed,
            });
            void pruneAriaMessagesDb(user_id);
          } catch {
            /* не блокируем отправку */
          }

          const { reply, attachment } = await postAriaMessage({
            userId: user_id,
            text: trimmed,
            history,
          });

          const aiNow = new Date().toISOString();
          let replyText = reply || '—';
          if (attachment?.mime_type?.startsWith('image/')) {
            replyText = replyText.replace(/\n\n🖼\s*https?:\/\/\S+/i, '').trim() || 'Инфографика';
          }
          try {
            const { error: ariaInsertError } = await supabase.from('aria_messages').insert({
              user_id,
              role: 'aria',
              text: replyText,
            });
            if (__DEV__ && ariaInsertError) console.warn('[Aria] insert aria error:', ariaInsertError);
            void pruneAriaMessagesDb(user_id);
          } catch (e) {
            if (__DEV__) console.warn('[Aria] insert aria catch:', e);
          }

          setAriaMessagesForChat((prev) => [
            ...stripTyping(prev),
            {
              ...baseRow,
              id: `aria-ai-${Date.now()}`,
              player_name: ARIA_CONTACT.display_name,
              text: replyText,
              created_at: aiNow,
              read_at: aiNow,
              message_type: 'text',
              aria_api_role: 'aria',
              ...(attachment ? { aria_attachment: attachment } : {}),
            },
          ]);
          void playAriaReplySound();
        } catch {
          const errNow = new Date().toISOString();
          setAriaMessagesForChat((prev) => [
            ...stripTyping(prev),
            {
              ...baseRow,
              id: `aria-err-${Date.now()}`,
              player_name: ARIA_CONTACT.display_name,
              text: 'Aria недоступна',
              created_at: errNow,
              read_at: errNow,
              message_type: 'text',
            },
          ]);
        }
      })();
    },
    [
      enabled,
      nickname,
      ariaResolvedNickname,
      setAriaMessagesForChat,
      playAriaReplySound,
    ],
  );

  const clearAriaHistory = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (!authErr) {
        const uid = auth?.user?.id;
        if (uid) {
          await supabase.from('aria_messages').delete().eq('user_id', uid);
        }
      }
    } catch {}
    setAriaMessages(getAriaSeedMessages());
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let cancelled = false;

      const loadPending = async () => {
        try {
          const { data: auth, error: authErr } = await supabase.auth.getUser();
          if (authErr) return;
          const user_id = auth?.user?.id;
          if (!user_id || cancelled) return;

          const texts = await fetchAriaPendingMessages(user_id);
          if (cancelled || texts.length === 0) return;

          setAriaMessagesForChat((prev) => {
            const known = new Set(
              prev
                .filter((m) => m.player_name === ARIA_CONTACT.display_name)
                .map((m) => (typeof m.text === 'string' ? m.text.trim() : '')),
            );
            const baseRow = createAriaMessageBaseRow();
            const additions = texts
              .filter((t) => t && !known.has(t))
              .map((text, i) => {
                const now = new Date().toISOString();
                return {
                  ...baseRow,
                  id: `aria-pending-${Date.now()}-${i}`,
                  player_name: ARIA_CONTACT.display_name,
                  text,
                  created_at: now,
                  read_at: now,
                  message_type: 'text',
                  aria_api_role: 'aria',
                };
              });
            if (additions.length === 0) return prev;
            return trimAriaDisplayMessages([...prev, ...additions]);
          });

          for (const text of texts) {
            try {
              await supabase.from('aria_messages').insert({
                user_id,
                role: 'aria',
                text,
              });
            } catch {
              /* не блокируем UI */
            }
          }
          void pruneAriaMessagesDb(user_id);
        } catch {
          /* сеть / API недоступны */
        }
      };

      void loadPending();
      return () => {
        cancelled = true;
      };
    }, [enabled, setAriaMessagesForChat]),
  );

  return {
    ariaMessages,
    setAriaMessagesForChat,
    sendToAria,
    clearAriaHistory,
    ariaOnline,
    ariaResolvedNickname,
    playAriaReplySound,
  };
}
