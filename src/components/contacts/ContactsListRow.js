import React from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import tw from 'twrnc';
import { V } from '../../theme';
import { VaultEmptyAvatar } from '../VaultAvatarShell';
import { useChatsListRowRipple } from '../chats/useChatsListRowRipple';

const AVATAR_CIRCLE_SIZE = 52;

function ContactAvatar({ name }) {
  return <VaultEmptyAvatar name={name} size={AVATAR_CIRCLE_SIZE} />;
}

const ContactsListRow = React.memo(
  function ContactsListRow({ name, onPress }) {
    const { onLayout, onPressIn, onPress: onRowPress, rippleOverlay } =
      useChatsListRowRipple(onPress);

    return (
      <View style={[tw`pt-0 pb-5`, { overflow: 'hidden' }]} onLayout={onLayout}>
        <Pressable
          onPressIn={onPressIn}
          onPress={onRowPress}
          android_ripple={null}
        >
          {rippleOverlay}
          <View style={tw`flex-row items-center`}>
            <ContactAvatar name={name} />
            <View style={tw`flex-1 ml-3 min-w-0`}>
              <Text
                style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  },
  (prev, next) => prev.name === next.name,
);

export default ContactsListRow;
