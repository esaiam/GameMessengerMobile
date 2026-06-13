import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import tw from 'twrnc';
import { AriaGradientAvatar } from '../chat/AriaChatUi';
import { Check } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { ARIA_CHATS_PREVIEW_TEXT } from '../../screens/chats/chatsConstants';
import { messagePreview, messagePreviewAsync } from '../../screens/chats/chatsPreviewCache';
import { formatChatListTime } from '../../screens/chats/chatsFormat';
import { VaultAvatarShell, VaultEmptyAvatar } from '../VaultAvatarShell';
import { usePeerAvatar } from '../../hooks/usePeerAvatar';
import { useChatsListRowRipple } from './useChatsListRowRipple';

const AVATAR_CIRCLE_SIZE = 52;
const AVATAR_SLOT_SIZE = 56;
const SELECTION_BADGE_SIZE = 20;

/** Внутренняя область под фото: border 1.5 внутри. */
const ARIA_LIST_IMAGE_SIZE = AVATAR_CIRCLE_SIZE - 3;

function PeerListAvatar({ name }) {
  const { avatarUri } = usePeerAvatar(name);

  if (!avatarUri) {
    return <VaultEmptyAvatar name={name} size={AVATAR_CIRCLE_SIZE} />;
  }

  return (
    <VaultAvatarShell size={AVATAR_CIRCLE_SIZE}>
      <Image
        key={avatarUri}
        source={{ uri: avatarUri }}
        style={{ width: ARIA_LIST_IMAGE_SIZE, height: ARIA_LIST_IMAGE_SIZE }}
        resizeMode="cover"
      />
    </VaultAvatarShell>
  );
}

function AriaListAvatar() {
  return (
    <VaultAvatarShell size={AVATAR_CIRCLE_SIZE}>
      <AriaGradientAvatar size={ARIA_LIST_IMAGE_SIZE} />
    </VaultAvatarShell>
  );
}

function AiBadge() {
  return (
    <View style={styles.aiBadge}>
      <Text style={styles.aiBadgeText}>AI</Text>
    </View>
  );
}

function AvatarWithSelectionBadge({ isSelected, children }) {
  return (
    <View style={styles.avatarSlot}>
      {children}
      {isSelected ? (
        <View style={styles.selectionBadge}>
          <Check size={12} color={V.bgChatsScreen} strokeWidth={2.5} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarSlot: {
    width: AVATAR_SLOT_SIZE,
    height: AVATAR_SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  aiBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(90,158,154,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(90,158,154,0.25)',
  },
  aiBadgeText: {
    fontSize: 8,
    fontWeight: '500',
    color: 'rgba(90,158,154,0.8)',
  },
  selectionBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: SELECTION_BADGE_SIZE,
    height: SELECTION_BADGE_SIZE,
    borderRadius: SELECTION_BADGE_SIZE / 2,
    backgroundColor: V.accentSage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: V.bgChatsScreen,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: V.accentSage,
    marginLeft: 8,
  },
});

const ChatsListRow = React.memo(
  function ChatsListRow({
    item,
    nickname,
    isUnread = false,
    onPress,
    onLongPress,
    selectionMode = false,
    isSelected = false,
  }) {
    const ts = item.last?.created_at || null;
    const [preview, setPreview] = useState(() =>
      item.isAria ? ARIA_CHATS_PREVIEW_TEXT : messagePreview(item.last),
    );

    useEffect(() => {
      if (item.isAria) {
        setPreview(ARIA_CHATS_PREVIEW_TEXT);
        return undefined;
      }
      let cancelled = false;
      messagePreviewAsync(item.last, nickname).then((text) => {
        if (!cancelled) setPreview(text);
      });
      return () => {
        cancelled = true;
      };
    }, [item.isAria, item.last?.id, item.last?.text, item.last?.message_type, nickname]);

    const { onLayout, onPressIn, onPress: onRowPress, rippleOverlay } =
      useChatsListRowRipple(onPress);

    return (
      <View style={styles.row} onLayout={onLayout}>
        <Pressable
          testID={item.isAria ? 'chat-row-aria' : `chat-row-${item.roomId}`}
          onPressIn={selectionMode ? undefined : onPressIn}
          onPress={onRowPress}
          onLongPress={onLongPress}
          delayLongPress={400}
          android_ripple={null}
        >
          {rippleOverlay}
          <View style={tw`flex-row items-center`}>
            <AvatarWithSelectionBadge isSelected={isSelected}>
              {item.isAria ? <AriaListAvatar /> : <PeerListAvatar name={item.contactName} />}
            </AvatarWithSelectionBadge>
            <View style={tw`flex-1 ml-3`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center flex-1 min-w-0 mr-2`}>
                  <Text
                    style={[
                      tw`text-[15px]`,
                      {
                        color: V.textPrimary,
                        fontWeight: isUnread ? '600' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.contactName}
                  </Text>
                  {item.isAria ? <AiBadge /> : null}
                </View>
                <View style={tw`flex-row items-center`}>
                  <Text
                    style={[
                      tw`text-[10px]`,
                      { color: isUnread ? V.accentSage : V.textMuted },
                    ]}
                  >
                    {formatChatListTime(ts)}
                  </Text>
                  {isUnread ? <View style={styles.unreadDot} /> : null}
                </View>
              </View>
              <Text
                style={[
                  tw`text-[12px] mt-0.5`,
                  {
                    color: isUnread ? V.textPrimary : V.textSecondary,
                    fontWeight: isUnread ? '500' : '400',
                  },
                ]}
                numberOfLines={1}
              >
                {preview}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  },
  (prev, next) =>
    prev.item.isAria === next.item.isAria &&
    prev.item.roomId === next.item.roomId &&
    prev.item.last?.id === next.item.last?.id &&
    prev.item.last?.created_at === next.item.last?.created_at &&
    prev.isUnread === next.isUnread &&
    prev.nickname === next.nickname &&
    prev.selectionMode === next.selectionMode &&
    prev.isSelected === next.isSelected,
);

export default ChatsListRow;
