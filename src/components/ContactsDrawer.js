import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  Pressable,
  Alert,
  TextInput,
  Platform,
  StyleSheet,
} from 'react-native';
import tw from 'twrnc';
import * as Clipboard from 'expo-clipboard';
import SafeBlurView from './SafeBlurView';
import { supabase } from '../lib/supabase';
import { TAB_BAR_INNER_ROW_H, TAB_BAR_LAYOUT, V } from '../theme';
import { UserPlus } from '../icons/lucideIcons';
import { normalizeUserPair } from '../utils/roomIds';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function AvatarCircle({ name }) {
  const letter = (name || '?')[0].toUpperCase();
  return (
    <View
      style={[
        tw`w-12 h-12 rounded-full items-center justify-center mr-3`,
        { backgroundColor: V.outBubbleBg },
      ]}
    >
      <Text style={[tw`text-[14px] font-medium`, { color: V.accentSage }]}>{letter}</Text>
    </View>
  );
}

export default function ContactsDrawer({
  visible,
  onClose,
  nickname,
  navigation,
  variant = 'drawer',
}) {
  const isScreen = variant === 'screen';
  const [contacts, setContacts] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const inviteScaleX = useRef(new Animated.Value(1)).current;
  const inviteScaleY = useRef(new Animated.Value(1)).current;
  const inviteRunAnimRef = useRef(null);

  const filteredContacts = useMemo(() => {
    const s = searchQ.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter((name) => (name || '').toLowerCase().includes(s));
  }, [contacts, searchQ]);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScreen) return;
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isScreen]);

  useEffect(() => {
    if (!nickname) return;
    if (isScreen) {
      fetchContacts();
      return;
    }
    if (visible) fetchContacts();
  }, [nickname, visible, isScreen]);

  const fetchContacts = async () => {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${nickname},user2_id.eq.${nickname}`);

    if (!rooms) return;

    const names = new Set();
    rooms.forEach((r) => {
      if (r.user1_id && r.user1_id !== nickname) names.add(r.user1_id);
      if (r.user2_id && r.user2_id !== nickname) names.add(r.user2_id);
    });
    setContacts([...names].sort());
  };

  const inviteFriends = useCallback(async () => {
    const code = (nickname || '').trim();
    if (!code) {
      Alert.alert('Профиль', 'Сначала укажи никнейм в профиле.');
      return;
    }
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Скопировано', 'Инвайт-код скопирован в буфер обмена.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось скопировать код.');
    }
  }, [nickname]);

  const openOrCreateRoom = async (contactName) => {
    try {
      const { user1Id, user2Id, roomId } = normalizeUserPair(nickname, contactName);

      const { data: existing, error: selErr } = await supabase
        .from('rooms')
        .select('id, code, user1_id, user2_id')
        .eq('id', roomId)
        .maybeSingle();

      if (selErr) {
        Alert.alert('Ошибка', selErr.message);
        return;
      }

      let room = existing;
      if (!room) {
        const code = generateRoomCode();
        const { data: created, error: insErr } = await supabase
          .from('rooms')
          .upsert(
            { id: roomId, code, user1_id: user1Id, user2_id: user2Id },
            { onConflict: 'id' }
          )
          .select('id, code, user1_id, user2_id')
          .single();
        if (insErr) {
          Alert.alert('Ошибка', insErr.message);
          return;
        }
        room = created;
      }

      onClose?.();
      navigation?.navigate('Game', {
        roomId: room.id,
        nickname,
        playerNumber: room.user1_id === nickname ? 1 : 2,
      });
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось открыть чат');
    }
  };

  const renderContact = ({ item }) => (
    <View
      style={[
        tw`flex-row items-center py-3 px-4`,
        { borderBottomWidth: 0.5, borderBottomColor: V.border },
      ]}
    >
      <AvatarCircle name={item} />
      <View style={tw`flex-1`}>
        <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]}>{item}</Text>
      </View>
      <TouchableOpacity
        style={[
          tw`rounded-[8px] px-3 py-1.5`,
          { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.accentSage },
        ]}
        onPress={() => openOrCreateRoom(item)}
      >
        <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]}>Открыть</Text>
      </TouchableOpacity>
    </View>
  );

  const screenListEmpty = (
    <View style={tw`py-10`}>
      {contacts.length === 0 ? (
        <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>
          Пока нет контактов. Сыграй с кем-нибудь!
        </Text>
      ) : (
        <Text style={[tw`text-center text-[13px]`, { color: V.textMuted }]}>Контакты не найдены</Text>
      )}
    </View>
  );

  const screenHeader = (
    <View style={{ backgroundColor: 'transparent' }}>
      <View style={tw`mb-3 pt-12`}>
        <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]}>Контакты</Text>
      </View>
      <View style={tw`mb-3`}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: TAB_BAR_LAYOUT.borderRadius,
              borderWidth: 2,
              borderColor: V.sageBorder,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: TAB_BAR_LAYOUT.borderRadius,
              borderWidth: 1,
              borderColor: V.sageFocus,
            },
          ]}
        />
        <SafeBlurView
          intensity={20}
          tint="dark"
          blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
          style={[
            tw`flex-row items-center`,
            {
              height: TAB_BAR_INNER_ROW_H,
              borderRadius: TAB_BAR_LAYOUT.borderRadius,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: V.border,
              paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
              paddingRight: 0,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: V.sageSubtle,
                opacity: 1,
              },
            ]}
          />
        <TextInput
          style={[
            tw`flex-1 text-[13px]`,
            {
              color: V.textPrimary,
              paddingVertical: 0,
              height: TAB_BAR_INNER_ROW_H,
            },
          ]}
          placeholder="Поиск..."
          placeholderTextColor={V.textGhost}
          value={searchQ}
          onChangeText={setSearchQ}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!searchQ && (
          <TouchableOpacity
            onPress={() => setSearchQ('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={tw`ml-2`}
            accessibilityRole="button"
            accessibilityLabel="Очистить поиск"
          >
            <Text style={[tw`text-[18px]`, { color: V.textPrimary, lineHeight: 18 }]}>×</Text>
          </TouchableOpacity>
        )}

        <Pressable
          onPress={inviteFriends}
          onPressIn={() => {
            inviteRunAnimRef.current?.stop?.();
            inviteScaleX.stopAnimation?.();
            inviteScaleY.stopAnimation?.();
            inviteScaleX.setValue(1);
            inviteScaleY.setValue(1);

            const anim = Animated.sequence([
              Animated.parallel([
                Animated.timing(inviteScaleX, {
                  toValue: 1.08,
                  duration: 95,
                  useNativeDriver: true,
                }),
                Animated.timing(inviteScaleY, {
                  toValue: 0.84,
                  duration: 95,
                  useNativeDriver: true,
                }),
              ]),
              Animated.parallel([
                Animated.spring(inviteScaleX, {
                  toValue: 1,
                  friction: 3,
                  tension: 200,
                  useNativeDriver: true,
                }),
                Animated.spring(inviteScaleY, {
                  toValue: 1,
                  friction: 3,
                  tension: 200,
                  useNativeDriver: true,
                }),
              ]),
            ]);

            inviteRunAnimRef.current = anim;
            anim.start();
          }}
          onPressOut={() => {
            // Ничего не делаем: возврат уже в последовательности onPressIn
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: 8, marginRight: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Пригласить друзей"
        >
          <Animated.View
            style={{
              width: TAB_BAR_INNER_ROW_H,
              height: TAB_BAR_INNER_ROW_H,
              borderRadius: TAB_BAR_INNER_ROW_H / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: V.sageSubtle,
              borderWidth: 1,
              borderColor: V.accentSage,
              transform: [{ scaleX: inviteScaleX }, { scaleY: inviteScaleY }],
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: TAB_BAR_INNER_ROW_H / 2,
                borderWidth: 2,
                borderColor: V.sageFocus,
                opacity: 1,
              }}
            />
            <UserPlus size={16} color={V.accentSage} strokeWidth={1.5} />
          </Animated.View>
        </Pressable>
        </SafeBlurView>
      </View>
    </View>
  );

  if (isScreen) {
    return (
      <View style={[tw`flex-1 px-4`, { backgroundColor: 'transparent' }]}>
        <FlatList
          style={tw`flex-1`}
          data={filteredContacts}
          keyExtractor={(item) => item}
          renderItem={renderContact}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={screenHeader}
          ListEmptyComponent={screenListEmpty}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  if (!visible) return null;

  return (
    <View style={[tw`absolute inset-0`, { zIndex: 100 }]}>
      <Pressable onPress={onClose} style={tw`absolute inset-0`}>
        <Animated.View
          style={[
            tw`absolute inset-0`,
            {
              backgroundColor: '#000',
              opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
            },
          ]}
        />
      </Pressable>

      <Animated.View
        style={[
          tw`absolute top-0 bottom-0 left-0`,
          {
            width: DRAWER_WIDTH,
            backgroundColor: V.bgApp,
            borderRightWidth: 0.5,
            borderRightColor: V.border,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={[tw`pt-14 pb-4 px-4`, { backgroundColor: V.bgElevated }]}>
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]}>Контакты</Text>
        </View>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item}
          renderItem={renderContact}
          ListEmptyComponent={
            <Text style={[tw`text-center py-8 text-[13px]`, { color: V.textMuted }]}>
              Пока нет контактов. Сыграй с кем-нибудь!
            </Text>
          }
        />
      </Animated.View>
    </View>
  );
}
