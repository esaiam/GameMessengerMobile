import React from 'react';
import { View, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { MessageCircle, User } from '../../icons/lucideIcons';
import { UserAvatar } from '../UserAvatar';
import { V } from '../../theme';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../MessengerHeaderLayout';
import {
  HEADER_MINI_AVATAR_SIZE,
  PROFILE_AVATAR_SIZE,
} from '../../hooks/useProfileCollapseHeader';
import ContactProfileActionButton from './ContactProfileActionButton';
import { styles } from '../../screens/contactProfile/contactProfileScreenStyles';

export default function ContactProfileFloatingChrome({
  profileLayoutW,
  contactOnline,
  displayName,
  peerAvatarUri,
  busy,
  blocked,
  onMessage,
  onContacts,
  actionsFloatTop,
  actionsFloatStyle,
  statusStartY,
  statusStyle,
  avatarTop,
  avatarWrapStyle,
  avatarGlowStyle,
  avatarGlowFillStyle,
  avatarGlowRingStyle,
  avatarGlowRingSoftStyle,
  nameStartY,
  nameStyle,
  headerStatusStyle,
  onNameLayout,
  headerNameLeft,
  headerStatusTop,
  headerMiniAvatarLeft,
  headerMiniAvatarTop,
  headerMiniAvatarStyle,
  nameHeaderChromeStackStyle,
}) {
  return (
    <>
      <View style={styles.floatingLayerUnder} pointerEvents="box-none">
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.actionsFloat,
            {
              top: actionsFloatTop,
              left: MESSENGER_HEADER_PADDING_HORIZONTAL,
              right: MESSENGER_HEADER_PADDING_HORIZONTAL,
            },
            actionsFloatStyle,
          ]}
        >
          <View style={styles.actionsRow}>
            <ContactProfileActionButton
              icon={<MessageCircle size={14} color={V.accentSage} strokeWidth={1.5} />}
              label="Сообщение"
              onPress={onMessage}
              disabled={busy || blocked}
            />
            <ContactProfileActionButton
              icon={<User size={14} color={V.textSecondary} strokeWidth={1.5} />}
              label="Контакты"
              onPress={onContacts}
              disabled={busy}
            />
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.statusFloat, { top: statusStartY }, statusStyle]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: contactOnline ? V.accentSage : V.textMuted },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: contactOnline ? V.accentSage : V.textMuted },
              ]}
            >
              {contactOnline ? 'в сети' : 'не в сети'}
            </Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.avatarFloat,
          {
            top: avatarTop,
            left: (profileLayoutW - PROFILE_AVATAR_SIZE) / 2,
            width: PROFILE_AVATAR_SIZE,
            height: PROFILE_AVATAR_SIZE,
            overflow: 'visible',
          },
          avatarWrapStyle,
        ]}
        collapsable={false}
      >
        <View style={styles.avatarCluster}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarGlowOutlineInner,
              avatarGlowRingStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarGlowOutlineOuter,
              avatarGlowRingSoftStyle,
            ]}
          />
          <Animated.View style={[styles.avatarGlowRing, avatarGlowStyle]}>
            <UserAvatar name={displayName} uri={peerAvatarUri} size={PROFILE_AVATAR_SIZE} />
            <Animated.View
              pointerEvents="none"
              style={[styles.avatarGlowFill, avatarGlowFillStyle]}
            />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.nameHeaderChrome, nameHeaderChromeStackStyle]}
        pointerEvents="box-none"
      >
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.nameFloat,
            { top: nameStartY, left: profileLayoutW / 2, color: V.textPrimary },
            nameStyle,
          ]}
          numberOfLines={1}
          onLayout={onNameLayout}
        >
          {displayName}
        </Animated.Text>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerStatusFloat,
            { top: headerStatusTop, left: headerNameLeft },
            headerStatusStyle,
          ]}
        >
          <View style={styles.headerStatusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: contactOnline ? V.accentSage : V.textMuted },
              ]}
            />
            <Text
              style={[
                styles.headerStatusText,
                { color: contactOnline ? V.accentSage : V.textMuted },
              ]}
            >
              {contactOnline ? 'в сети' : 'не в сети'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerMiniAvatar,
            {
              left: headerMiniAvatarLeft,
              top: headerMiniAvatarTop,
            },
            headerMiniAvatarStyle,
          ]}
        >
          <UserAvatar
            name={displayName}
            uri={peerAvatarUri}
            size={HEADER_MINI_AVATAR_SIZE}
          />
        </Animated.View>
      </Animated.View>
    </>
  );
}
