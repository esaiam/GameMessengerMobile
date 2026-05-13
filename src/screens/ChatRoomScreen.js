import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import { Audio } from 'expo-av';
import tw from 'twrnc';
import Chat from '../components/Chat';
import { AriaClearHistoryHeaderButton } from '../components/ChatRoomHeader';
import { supabase } from '../lib/supabase';
import {
  ARIA_API_URL,
  ARIA_CONTACT,
  ARIA_MESSAGE_TYPING,
  createAriaMessageBaseRow,
  getAriaSeedMessages,
  isAriaPersistableMessage,
} from '../lib/aria';
import { V } from '../theme';
import { setAudioModeAsync } from '../utils/audioMode';
import { usePresence } from '../hooks/usePresence';

const ARIA_REPLY_VOLUME = 0.3;
const ARIA_MESSAGE_RECEIVED_MP3 = require('../assets/sounds/message_received.mp3');

let ariaReplyModeReady = false;
let ariaReplyPlayer = null;
let ariaReplyPlayerCreating = null;
let ariaReplyFallbackSound = null;

async function ensureAriaReplyAudioMode() {
  if (ariaReplyModeReady) return;
  await setIsAudioActiveAsync(true);
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
    shouldRouteThroughEarpiece: false,
  });
  ariaReplyModeReady = true;
}

async function ensureAriaReplyPlayer() {
  if (ariaReplyPlayer) return;
  if (ariaReplyPlayerCreating) {
    await ariaReplyPlayerCreating;
    return;
  }
  ariaReplyPlayerCreating = (async () => {
    await ensureAriaReplyAudioMode();
    try {
      ariaReplyPlayer = createAudioPlayer(ARIA_MESSAGE_RECEIVED_MP3, {
        downloadFirst: true,
        keepAudioSessionActive: false,
      });
    } catch {
      ariaReplyPlayer = null;
    }
  })();
  try {
    await ariaReplyPlayerCreating;
  } finally {
    ariaReplyPlayerCreating = null;
  }
}

async function playAriaReplySound() {
  try {
    await ensureAriaReplyPlayer();
    if (ariaReplyPlayer) {
      ariaReplyPlayer.volume = ARIA_REPLY_VOLUME;
      await ariaReplyPlayer.seekTo(0);
      ariaReplyPlayer.play();
      return;
    }
  } catch {
    ariaReplyPlayer = null;
  }

  try {
    await ensureAriaReplyAudioMode();
    if (ariaReplyFallbackSound) {
      try {
        await ariaReplyFallbackSound.unloadAsync();
      } catch {
        /* ignore */
      }
      ariaReplyFallbackSound = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      ARIA_MESSAGE_RECEIVED_MP3,
      { shouldPlay: true, volume: ARIA_REPLY_VOLUME }
    );
    ariaReplyFallbackSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || !status.didJustFinish) return;
      sound.unloadAsync().catch(() => {});
      ariaReplyFallbackSound = null;
    });
  } catch {
    /* ignore */
  }
}

/** Строка из `aria_messages` → формат ленты Chat. */
function ariaMessagesFromDbRows(rows, nickname) {
  return rows.map((row) => {
    const baseRow = createAriaMessageBaseRow();
    const created_at = row.created_at || new Date().toISOString();
    const isUser = row.role === 'user';
    return {
      ...baseRow,
      id: `aria-db-${row.id}`,
      player_name: isUser ? nickname : ARIA_CONTACT.display_name,
      text: typeof row.text === 'string' ? row.text : '',
      created_at,
      read_at: created_at,
      message_type: 'text',
    };
  });
}

function buildAriaRequestHistory(messages, opts = {}) {
  const filtered = messages.filter(isAriaPersistableMessage);
  const mapped = filtered.slice(-20).map((m) => ({
    role: m.player_name === ARIA_CONTACT.display_name ? 'aria' : 'user',
    text: typeof m.text === 'string' ? m.text : '',
  }));
  if (opts.lastUserTextOverride) {
    for (let i = mapped.length - 1; i >= 0; i -= 1) {
      if (mapped[i].role === 'user') {
        mapped[i] = { ...mapped[i], text: opts.lastUserTextOverride };
        break;
      }
    }
  }
  return mapped;
}

export default function ChatRoomScreen({ route, navigation }) {
  const { nickname, roomId, roomCode, title, peerName, isAriaChat, contact } = route.params || {};
  const insets = useSafeAreaInsets();

  const [ariaMessages, setAriaMessages] = useState(() =>
    route.params?.isAriaChat ? getAriaSeedMessages() : []
  );
  const ariaMessagesRef = useRef(ariaMessages);
  ariaMessagesRef.current = ariaMessages;

  const ariaTypingSeqRef = useRef(0);

  /** Перед любым функциональным обновлением ленты убирает предыдущий typing-row (один индикатор). */
  const setAriaMessagesForChat = useCallback((update) => {
    setAriaMessages((prev) => {
      if (typeof update !== 'function') return update;
      const prevSansTyping = prev.filter(
        (m) => !(m.message_type === ARIA_MESSAGE_TYPING || m.isTyping)
      );
      return update(prevSansTyping);
    });
  }, []);

  /** null = ещё резолвим; string (в т.ч. '') = можно грузить историю и матчить «мои» сообщения */
  const [ariaResolvedNickname, setAriaResolvedNickname] = useState(null);

  useEffect(() => {
    if (!isAriaChat) return;
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
  }, [isAriaChat, nickname]);

  useEffect(() => {
    if (!isAriaChat) return;
    if (ariaResolvedNickname === null) return;

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
          .limit(50);

        if (cancelled) return;
        if (error) throw error;

        const rows = Array.isArray(data) ? [...data].reverse() : [];
        if (rows.length > 0) {
          setAriaMessages(ariaMessagesFromDbRows(rows, ariaResolvedNickname));
        }
      } catch {
        /* оставляем приветствие getAriaSeedMessages */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAriaChat, ariaResolvedNickname]);

  const sendToAria = useCallback(
    async (text, options = {}) => {
      const aria_voice_message = !!options.aria_voice_message;
      const skipOptimisticUserTyping = options.skipOptimisticUserTyping === true;
      const trimmed = text.trim();
      if (!trimmed) return;

      const typingId = `aria-typing-${Date.now()}-${ariaTypingSeqRef.current++}`;
      const displayNickname =
        ariaResolvedNickname !== null ? ariaResolvedNickname : typeof nickname === 'string' ? nickname : '';

      const baseRow = createAriaMessageBaseRow();

      const history = buildAriaRequestHistory(
        ariaMessagesRef.current,
        skipOptimisticUserTyping ? { lastUserTextOverride: trimmed } : {}
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
          } catch {
            /* не блокируем отправку */
          }

          const res = await fetch(`${ARIA_API_URL}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id,
              text: trimmed,
              platform: 'vault',
              history,
            }),
          });

          let json = {};
          try {
            json = await res.json();
          } catch {
            json = {};
          }
          if (!res.ok) throw new Error(`http_${res.status}`);

          const replyRaw = json?.reply;
          const reply =
            typeof replyRaw === 'string' && replyRaw.length > 0
              ? replyRaw
              : typeof json?.message === 'string' && json.message.length > 0
                ? json.message
                : '';

          const aiNow = new Date().toISOString();
          const replyText = reply || '—';
          try {
            const { error: ariaInsertError } = await supabase.from('aria_messages').insert({
              user_id,
              role: 'aria',
              text: replyText,
            });
            if (ariaInsertError) console.warn('[Aria] insert aria error:', ariaInsertError);
          } catch (e) {
            console.warn('[Aria] insert aria catch:', e);
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
    [nickname, ariaResolvedNickname]
  );

  const handleAriaClearHistory = useCallback(() => {
    Alert.alert(
      'Очистить историю?',
      'Переписка с Aria будет удалена безвозвратно.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ]
    );
  }, []);

  const headerTitle = useMemo(() => {
    if (isAriaChat && contact?.display_name) return contact.display_name;
    return title || 'Чат';
  }, [title, isAriaChat, contact?.display_name]);
  const contactOnline = usePresence({
    roomId,
    nickname,
    targetName: headerTitle !== 'Чат' ? headerTitle : null,
    skip: !roomId || !nickname || isAriaChat,
  });
  const [ariaOnline, setAriaOnline] = useState(null);
  const [frostedHeaderH, setFrostedHeaderH] = useState(0);
  const [listPaddingTop, setListPaddingTop] = useState(insets.top + 75);

  const chatRoomHeader = useMemo(
    () => ({
      title: headerTitle,
      contactOnline,
      navigation,
      ...(isAriaChat ? { ariaOnline } : {}),
      ...(isAriaChat
        ? {
            headerRight: (
              <AriaClearHistoryHeaderButton onPress={handleAriaClearHistory} />
            ),
          }
        : {}),
    }),
    [headerTitle, contactOnline, navigation, isAriaChat, ariaOnline, handleAriaClearHistory]
  );

  useEffect(() => {
    if (frostedHeaderH > 0) {
      setListPaddingTop(frostedHeaderH);
    }
  }, [frostedHeaderH]);

  useEffect(() => {
    if (!isAriaChat) return;
    let cancelled = false;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 3000);
    setAriaOnline(null);
    (async () => {
      try {
        const res = await fetch(`${ARIA_API_URL}/health`, { signal: ac.signal });
        clearTimeout(timeoutId);
        if (cancelled) return;
        let json = {};
        try {
          json = await res.json();
        } catch {
          json = {};
        }
        const ok = res.ok && json?.status === 'ok';
        setAriaOnline(ok);
      } catch {
        clearTimeout(timeoutId);
        if (!cancelled) setAriaOnline(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      try {
        ac.abort();
      } catch {}
    };
  }, [isAriaChat]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: V.bgApp }]}>
      <Chat
        roomId={roomId}
        roomCode={roomCode}
        nickname={
          isAriaChat && ariaResolvedNickname !== null ? ariaResolvedNickname : nickname
        }
        peerName={isAriaChat ? contact?.display_name || ARIA_CONTACT.display_name : peerName || title}
        isAriaChat={!!isAriaChat}
        ariaMessages={isAriaChat ? ariaMessages : undefined}
        setAriaMessages={isAriaChat ? setAriaMessagesForChat : undefined}
        sendToAria={isAriaChat ? sendToAria : undefined}
        listPaddingTop={listPaddingTop}
        chatRoomHeader={chatRoomHeader}
        onTopOverlayHeight={setFrostedHeaderH}
      />
    </View>
  );
}
