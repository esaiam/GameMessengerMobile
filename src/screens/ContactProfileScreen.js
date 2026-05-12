import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MessageCircle, User } from '../icons/lucideIcons';
import { UserAvatar } from '../components/UserAvatar';
import { V } from '../theme';

export default function ContactProfileScreen({ route, navigation }) {
  const { peerName, contactOnline, roomId, nickname } = route.params || {};
  const insets = useSafeAreaInsets();

  const goBackToChat = () => {
    navigation.goBack();
  };

  const handleBlock = () => {
    Alert.alert(
      'Заблокировать',
      `Заблокировать ${peerName}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Заблокировать', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      'Удалить переписку',
      'Переписка будет удалена только у вас.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: V.bgApp }]}>
      {/* Header bar */}
      <View
        style={[
          styles.headerBar,
          { paddingTop: insets.top + 10, borderBottomColor: V.border },
        ]}
      >
        <TouchableOpacity
          onPress={goBackToChat}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={V.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: V.textPrimary }]} numberOfLines={1}>
          {peerName || 'Профиль'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + identity */}
        <View style={styles.identity}>
          <UserAvatar name={peerName || '?'} uri={null} size={80} />
          <Text
            style={[styles.nameText, { color: V.textPrimary }]}
            numberOfLines={1}
          >
            {peerName || '—'}
          </Text>
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
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <ActionButton
            icon={<MessageCircle size={16} color={V.accentSage} strokeWidth={1.5} />}
            label="Сообщение"
            onPress={goBackToChat}
          />
          <ActionButton
            icon={<User size={16} color={V.textSecondary} strokeWidth={1.5} />}
            label="Контакт"
            onPress={() => {}}
          />
        </View>

        {/* Danger zone */}
        <View
          style={[
            styles.dangerCard,
            { backgroundColor: V.bgSurface, borderColor: V.border },
          ]}
        >
          <DangerRow label="Заблокировать" onPress={handleBlock} />
          <View style={[styles.separator, { backgroundColor: V.border }]} />
          <DangerRow label="Удалить переписку" onPress={handleDeleteConversation} last />
        </View>
      </ScrollView>
    </View>
  );
}

function ActionButton({ icon, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.actionBtn,
        { backgroundColor: V.bgElevated, borderColor: V.border },
      ]}
    >
      {icon}
      <Text
        style={[styles.actionLabel, { color: V.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DangerRow({ label, onPress, last }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.dangerRow, last ? null : null]}
    >
      <Text style={[styles.dangerLabel, { color: V.dangerMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    alignItems: 'center',
  },
  identity: {
    alignItems: 'center',
    marginBottom: 32,
  },
  nameText: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '500',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  dangerCard: {
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  dangerRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerLabel: {
    fontSize: 14,
    fontWeight: '400',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
});
