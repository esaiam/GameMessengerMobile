import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Alert, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import Chat from '../components/Chat';
import { AriaChatContainer } from '../components/chat/AriaChatContainer';
import ChatClearHistoryConfirmModal from '../components/chat/ChatClearHistoryConfirmModal';
import { AriaClearHistoryHeaderButton } from '../components/ChatRoomHeader';
import { ARIA_CONTACT } from '../lib/aria';
import { V } from '../theme';
import { usePresence } from '../hooks/usePresence';
import { useAriaChatSession } from '../hooks/useAriaChatSession';
import { Phone } from '../icons/lucideIcons';
import { useMessengerScreenBackHandler } from '../lib/safeGoBack';
import { useIsFocused } from '@react-navigation/native';

export default function ChatRoomScreen({ route, navigation }) {
  const { nickname, roomId, roomCode, title, peerName, isAriaChat, contact } = route.params || {};
  const insets = useSafeAreaInsets();
  const roomFocused = useIsFocused();
  useMessengerScreenBackHandler(navigation);

  const {
    ariaMessages,
    setAriaMessagesForChat,
    sendToAria,
    clearAriaHistory,
    ariaOnline,
    ariaResolvedNickname,
  } = useAriaChatSession(isAriaChat, nickname);

  const headerTitle = useMemo(() => {
    if (isAriaChat && contact?.display_name) return contact.display_name;
    // peerName нужен для шапки и presence: с Контактов часто передают только peerName без title.
    return title || peerName || 'Чат';
  }, [title, peerName, isAriaChat, contact?.display_name]);
  const contactOnline = usePresence({
    roomId,
    nickname,
    targetName: headerTitle !== 'Чат' ? headerTitle : null,
    skip: !roomId || !nickname || isAriaChat,
  });
  const [frostedHeaderH, setFrostedHeaderH] = useState(0);
  const [listPaddingTop, setListPaddingTop] = useState(insets.top + 75);
  const [ariaClearConfirmVisible, setAriaClearConfirmVisible] = useState(false);
  const [ariaClearInProgress, setAriaClearInProgress] = useState(false);

  const confirmAriaClearHistory = useCallback(async () => {
    if (ariaClearInProgress) return;
    setAriaClearInProgress(true);
    try {
      await clearAriaHistory();
      setAriaClearConfirmVisible(false);
    } finally {
      setAriaClearInProgress(false);
    }
  }, [ariaClearInProgress, clearAriaHistory]);

  const chatRoomHeader = useMemo(
    () => ({
      title: headerTitle,
      peerHandle: isAriaChat ? null : peerName || title || null,
      contactOnline,
      navigation,
      ...(isAriaChat ? { ariaOnline } : {}),
      ...(isAriaChat
        ? {
            headerRight: (
              <AriaClearHistoryHeaderButton onPress={() => setAriaClearConfirmVisible(true)} />
            ),
          }
        : roomId
          ? {
              headerRight: (
                <TouchableOpacity
                  onPress={() => Alert.alert('Звонок', 'Голосовые звонки скоро!')}
                  style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Phone size={20} color={V.textPrimary} strokeWidth={1.5} />
                </TouchableOpacity>
              ),
            }
          : {}),
    }),
    [headerTitle, peerName, title, contactOnline, navigation, isAriaChat, ariaOnline, roomId],
  );

  useEffect(() => {
    if (frostedHeaderH > 0) {
      setListPaddingTop(frostedHeaderH);
    }
  }, [frostedHeaderH]);

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
          roomFocused={roomFocused}
        />
      )}
      {isAriaChat ? (
        <ChatClearHistoryConfirmModal
          uiReady
          visible={ariaClearConfirmVisible}
          confirmDisabled={ariaClearInProgress}
          onClose={() => {
            if (!ariaClearInProgress) setAriaClearConfirmVisible(false);
          }}
          onConfirm={() => {
            void confirmAriaClearHistory();
          }}
          title="Очистить переписку?"
          description="Переписка с Aria будет удалена безвозвратно."
          confirmLabel="Очистить"
          showEveryoneCheckbox={false}
        />
      ) : null}
    </View>
  );
}
