import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import { Audio } from 'expo-av';
import tw from 'twrnc';
import Chat from '../components/Chat';
import { AriaClearHistoryHeaderButton } from '../components/ChatRoomHeader';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import {
  ARIA_API_URL,
  ARIA_CONTACT,
  ARIA_MESSAGE_TYPING,
  ARIA_TYPING_ROW_ID,
  createAriaMessageBaseRow,
  getAriaSeedMessages,
  isAriaPersistableMessage,
} from '../lib/aria';
import { V } from '../theme';
import { setAudioModeAsync } from '../utils/audioMode';

const ARIA_CHAT_STORAGE_KEY = 'aria_chat_history';
const ARIA_CHAT_MAX_MESSAGES = 100;

const ARIA_REPLY_VOLUME = 0.3;
const ARIA_REPLY_FALLBACK_URI =
  'https://www.soundjay.com/buttons/sounds/button-09a.mp3';
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
      { uri: ARIA_REPLY_FALLBACK_URI },
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
  const ariaStorageHydratedRef = useRef(!route.params?.isAriaChat);
  const ariaMessagesRef = useRef(ariaMessages);
  ariaMessagesRef.current = ariaMessages;

  useEffect(() => {
    if (!isAriaChat) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ARIA_CHAT_STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAriaMessages(parsed.slice(-ARIA_CHAT_MAX_MESSAGES));
          }
        }
      } catch {}
      if (cancelled) return;
      ariaStorageHydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAriaChat]);

  useEffect(() => {
    if (!isAriaChat || !ariaStorageHydratedRef.current) return;
    const persistable = ariaMessages.filter(isAriaPersistableMessage);
    const trimmed = persistable.slice(-ARIA_CHAT_MAX_MESSAGES);
    AsyncStorage.setItem(ARIA_CHAT_STORAGE_KEY, JSON.stringify(trimmed)).catch(() => {});
  }, [isAriaChat, ariaMessages]);

  const sendToAria = useCallback(
    async (text, options = {}) => {
      const aria_voice_message = !!options.aria_voice_message;
      const skipOptimisticUserTyping = options.skipOptimisticUserTyping === true;
      const trimmed = text.trim();
      if (!trimmed) return;

      const typingId = ARIA_TYPING_ROW_ID;

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
          player_name: nickname,
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
        setAriaMessages((prev) => [...prev, userRow, typingRow]);
      }

      const stripTyping = (prev) => prev.filter((m) => m.id !== typingId);

      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        const user_id = auth?.user?.id;
        if (!user_id) throw new Error('no_user');

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
        setAriaMessages((prev) => [
          ...stripTyping(prev),
          {
            ...baseRow,
            id: `aria-ai-${Date.now()}`,
            player_name: ARIA_CONTACT.display_name,
            text: reply || '—',
            created_at: aiNow,
            read_at: aiNow,
            message_type: 'text',
          },
        ]);
        void playAriaReplySound();
      } catch {
        const errNow = new Date().toISOString();
        setAriaMessages((prev) => [
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
    },
    [nickname]
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
              await AsyncStorage.removeItem(ARIA_CHAT_STORAGE_KEY);
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
  const [contactOnline, setContactOnline] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      parent?.setOptions?.({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions?.({ tabBarStyle: undefined });
    }, [navigation])
  );

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

  useEffect(() => {
    if (!roomId || !nickname || isAriaChat) return;

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
      const other = headerTitle && headerTitle !== 'Чат' ? headerTitle : null;
      if (!other) {
        setContactOnline(false);
        return;
      }
      setContactOnline(online.has(other));
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
  }, [roomId, nickname, headerTitle, isAriaChat]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: V.bgApp }]}>
      <Chat
        roomId={roomId}
        roomCode={roomCode}
        nickname={nickname}
        peerName={isAriaChat ? contact?.display_name || ARIA_CONTACT.display_name : peerName || title}
        isAriaChat={!!isAriaChat}
        ariaMessages={isAriaChat ? ariaMessages : undefined}
        setAriaMessages={isAriaChat ? setAriaMessages : undefined}
        sendToAria={isAriaChat ? sendToAria : undefined}
        listPaddingTop={listPaddingTop}
        chatRoomHeader={chatRoomHeader}
        onTopOverlayHeight={setFrostedHeaderH}
      />
    </View>
  );
}
