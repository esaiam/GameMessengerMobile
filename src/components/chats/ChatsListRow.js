import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import tw from 'twrnc';
import { AriaGradientAvatar } from '../chat/AriaChatUi';
import { Check } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { ARIA_CHATS_PREVIEW_TEXT } from '../../screens/chats/chatsConstants';
import { messagePreview, messagePreviewAsync } from '../../screens/chats/chatsPreviewCache';
import { formatChatListTime, getInitials } from '../../screens/chats/chatsFormat';
import { useChatsListRowRipple } from './useChatsListRowRipple';

const AVATAR_SIZE = 56;
const SELECTION_BADGE_SIZE = 20;

function Avatar({ name }) {
  return (
    <View
      style={[
        {
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: AVATAR_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: V.outBubbleBg,
        },
      ]}
    >
      <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

function AvatarWithSelectionBadge({ isSelected, children }) {
  return (
    <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>
      {children}
      {isSelected ? (
        <View style={styles.selectionBadge}>
          <Check size={12} color={V.bgApp} strokeWidth={2.5} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: V.bgApp,
  },
});

const ChatsListRow = React.memo(
  function ChatsListRow({
    item,
    nickname,
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
      <View
        style={[tw`pt-0 pb-5`, { overflow: 'hidden' }]}
        onLayout={onLayout}
      >
        <Pressable
          onPressIn={selectionMode ? undefined : onPressIn}
          onPress={onRowPress}
          onLongPress={onLongPress}
          delayLongPress={400}
          android_ripple={null}
        >
          {rippleOverlay}
          <View style={tw`flex-row items-center`}>
            <AvatarWithSelectionBadge isSelected={isSelected}>
              {item.isAria ? (
                <AriaGradientAvatar size={AVATAR_SIZE} />
              ) : (
                <Avatar name={item.contactName} />
              )}
            </AvatarWithSelectionBadge>
            <View style={tw`flex-1 ml-3`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center flex-1 min-w-0 mr-2`}>
                  <Text
                    style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.contactName}
                  </Text>
                  {item.isAria ? (
                    <Text
                      style={[
                        tw`text-[10px] font-medium ml-1.5`,
                        { color: V.accentSage, opacity: 0.8 },
                      ]}
                    >
                      AI
                    </Text>
                  ) : null}
                </View>
                <Text style={[tw`text-[10px]`, { color: V.textMuted }]}>
                  {formatChatListTime(ts)}
                </Text>
              </View>
              <Text
                style={[tw`text-[12px] mt-0.5`, { color: V.textSecondary }]}
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
    prev.selectionMode === next.selectionMode &&
    prev.isSelected === next.isSelected,
);

export default ChatsListRow;
