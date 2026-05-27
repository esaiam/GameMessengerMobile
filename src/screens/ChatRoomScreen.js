import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import tw from 'twrnc';
import Chat from '../components/Chat';
import { AriaChatContainer } from '../components/chat/AriaChatContainer';
import { AriaClearHistoryHeaderButton } from '../components/ChatRoomHeader';
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
  postAriaMessage } from '../lib/aria';
import { V } from '../theme';
import { setAudioModeAsync } from '../utils/audioMode';
import { usePresence } from '../hooks/usePresence';
import { Phone } from '../icons/lucideIcons';
import { useMessengerScreenBackHandler } from '../lib/safeGoBack';

const ARIA_REPLY_VOLUME = 0.3;
const ARIA_MESSAGE_RECEIVED_MP3 = require('../assets/sounds/message_received.mp3');

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
      aria_api_role };
  });
}

export default function ChatRoomScreen({ route, navigation }) {
  const { nickname, roomId, roomCode, title, peerName, isAriaChat, contact } = route.params || {};
  const insets = useSafeAreaInsets();
  useMessengerScreenBackHandler(navigation);

  const [ariaMessages, setAriaMessages] = useState(() =>
    route.params?.isAriaChat ? getAriaSeedMessages() : []
  );
  const ariaMessagesRef = useRef(ariaMessages);
  ariaMessagesRef.current = ariaMessages;

  const ariaTypingSeqRef = useRef(0);

  const ariaReplyModeReadyRef = useRef(false);
  const ariaReplyPlayerRef = useRef(null);
  const ariaReplyPlayerCreatingRef = useRef(null);
  const ariaReplyFallbackPlayerRef = useRef(null);

  const ensureAriaReplyAudioMode = useCallback(async () => {
    if (ariaReplyModeReadyRef.current) return;
    await setIsAudioActiveAsync(true);
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false });
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
          keepAudioSessionActive: false });
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
    return () => {
      try { ariaReplyPlayerRef.current?.release?.(); } catch {}
      ariaReplyPlayerRef.current = null;
      ariaReplyModeReadyRef.current = false;
      try { ariaReplyFallbackPlayerRef.current?.remove?.(); } catch {}
      ariaReplyFallbackPlayerRef.current = null;
    };
  }, []);

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
          aria_api_role: 'user',
          ...(aria_voice_message ? { aria_voice_message: true } : {}) };
        const typingRow = {
          ...baseRow,
          id: typingId,
          player_name: ARIA_CONTACT.display_name,
          text: '',
          created_at: now,
          read_at: null,
          message_type: ARIA_MESSAGE_TYPING,
          isTyping: true };
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
              text: trimmed });
          } catch {
            /* не блокируем отправку */
          }

          const { reply, attachment } = await postAriaMessage({
            userId: user_id,
            text: trimmed,
            history });

          const aiNow = new Date().toISOString();
          let replyText = reply || '—';
          if (attachment?.mime_type?.startsWith('image/')) {
            replyText = replyText.replace(/\n\n🖼\s*https?:\/\/\S+/i, '').trim() || 'Инфографика';
          }
          try {
            const { error: ariaInsertError } = await supabase.from('aria_messages').insert({
              user_id,
              role: 'aria',
              text: replyText });
            if (__DEV__ && ariaInsertError) console.warn('[Aria] insert aria error:', ariaInsertError);
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
              ...(attachment ? { aria_attachment: attachment } : {}) }]);
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
              message_type: 'text' }]);
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
          } }]
    );
  }, []);

  const headerTitle = useMemo(() => {
    if (isAriaChat && contact?.display_name) return contact.display_name;
    // peerName нужен для шапки и presence: с Контактов часто передают только peerName без title.
    return title || peerName || 'Чат';
  }, [title, peerName, isAriaChat, contact?.display_name]);
  const contactOnline = usePresence({
    roomId,
    nickname,
    targetName: headerTitle !== 'Чат' ? headerTitle : null,
    skip: !roomId || !nickname || isAriaChat });
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
            ) }
        : roomId
          ? {
              headerRight: (
                <TouchableOpacity
                  onPress={() => Alert.alert('Звонок', 'Голосовые звонки скоро!')}
                  style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center' }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Phone size={20} color={V.textPrimary} strokeWidth={1.5} />
                </TouchableOpacity>
              ) }
          : {}) }),
    [headerTitle, contactOnline, navigation, isAriaChat, ariaOnline, handleAriaClearHistory, roomId]
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
  }, [isAriaChat]);

  useFocusEffect(
    useCallback(() => {
      if (!isAriaChat) return;
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
                .map((m) => (typeof m.text === 'string' ? m.text.trim() : ''))
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
                  aria_api_role: 'aria' };
              });
            if (additions.length === 0) return prev;
            return [...prev, ...additions];
          });

          for (const text of texts) {
            try {
              await supabase.from('aria_messages').insert({
                user_id,
                role: 'aria',
                text });
            } catch {
              /* не блокируем UI */
            }
          }
        } catch {
          /* сеть / API недоступны */
        }
      };

      void loadPending();
      return () => {
        cancelled = true;
      };
    }, [isAriaChat, ariaResolvedNickname, nickname, setAriaMessagesForChat])
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: V.bgApp }]}>
      {isAriaChat ? (
        <AriaChatContainer
          roomId={roomId}
          roomCode={roomCode}
          nickname={isAriaChat && ariaResolvedNickname !== null ? ariaResolvedNickname : nickname}
          peerName={isAriaChat ? contact?.display_name || ARIA_CONTACT.display_name : peerName || title}
          ariaMessages={ariaMessages}
          setAriaMessages={setAriaMessagesForChat}
          sendToAria={sendToAria}
          listPaddingTop={listPaddingTop}
          chatRoomHeader={chatRoomHeader}
          onTopOverlayHeight={setFrostedHeaderH}
        />
      ) : (
        <Chat
          roomId={roomId}
          roomCode={roomCode}
          nickname={nickname}
          peerName={peerName || title}
          listPaddingTop={listPaddingTop}
          chatRoomHeader={chatRoomHeader}
          onTopOverlayHeight={setFrostedHeaderH}
        />
      )}
    </View>
  );
}
