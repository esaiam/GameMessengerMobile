import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import tw from 'twrnc';
import SafeBlurView from '../SafeBlurView';
import { SEARCH_FIELD_LAYOUT, SEARCH_CONTACTS_CAPSULE_RADIUS, V } from '../../theme';
import { UserPlus } from '../../icons/lucideIcons';
import { HANDLE_RE } from '../../lib/handleProfile';
import ContactsAvatarCircle from './ContactsAvatarCircle';

export default function ContactsSearchHeader({
  headerLayout,
  searchQ,
  onSearchChange,
  onOpenInvite,
  handleSearchLoading,
  handlePrefixForUi,
  handleResults,
  onOpenContact,
}) {
  const inviteScaleX = useRef(new Animated.Value(1)).current;
  const inviteScaleY = useRef(new Animated.Value(1)).current;
  const inviteRunAnimRef = useRef(null);

  const onInvitePressIn = useCallback(() => {
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
  }, [inviteScaleX, inviteScaleY]);

  const showHandleEmpty =
    !handleSearchLoading &&
    searchQ.trimStart().startsWith('@') &&
    handlePrefixForUi.length >= 2 &&
    HANDLE_RE.test(handlePrefixForUi) &&
    handleResults.length === 0;

  return (
    <View style={{ backgroundColor: 'transparent' }}>
      <View style={[headerLayout.containerStyle, { backgroundColor: 'transparent' }]}>
        <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
          Контакты
        </Text>
      </View>
      <View style={{ paddingHorizontal: headerLayout.paddingHorizontal }}>
        <View style={tw`mb-3`}>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: SEARCH_CONTACTS_CAPSULE_RADIUS,
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
                borderRadius: SEARCH_CONTACTS_CAPSULE_RADIUS,
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
                height: SEARCH_FIELD_LAYOUT.contactsRowHeight,
                borderRadius: SEARCH_CONTACTS_CAPSULE_RADIUS,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
                paddingLeft: SEARCH_FIELD_LAYOUT.rowPaddingH,
                paddingRight: 0,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: V.sageSubtle, opacity: 1 },
              ]}
            />
            <TextInput
              style={[
                tw`flex-1 text-[16px]`,
                {
                  color: V.textPrimary,
                  paddingVertical: 0,
                  height: SEARCH_FIELD_LAYOUT.contactsRowHeight,
                },
              ]}
              placeholder="Поиск по имени или @handle"
              placeholderTextColor={V.textGhost}
              value={searchQ}
              onChangeText={onSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!searchQ && (
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={tw`ml-2`}
                accessibilityRole="button"
                accessibilityLabel="Очистить поиск"
              >
                <Text style={[tw`text-[18px]`, { color: V.textPrimary, lineHeight: 18 }]}>×</Text>
              </TouchableOpacity>
            )}

            <Pressable
              onPress={onOpenInvite}
              onPressIn={onInvitePressIn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 8, marginRight: 0 }}
              accessibilityRole="button"
              accessibilityLabel="Коды приглашений"
            >
              <Animated.View
                style={{
                  width: SEARCH_FIELD_LAYOUT.contactsRowHeight,
                  height: SEARCH_FIELD_LAYOUT.contactsRowHeight,
                  borderRadius: SEARCH_FIELD_LAYOUT.contactsRowHeight / 2,
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
                    borderRadius: SEARCH_FIELD_LAYOUT.contactsRowHeight / 2,
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

        <View style={tw`mb-4`}>
          {handleSearchLoading ? (
            <Text style={[tw`text-[12px] ml-1 mb-1`, { color: V.textMuted }]}>Поиск…</Text>
          ) : null}
          {showHandleEmpty ? (
            <Text style={[tw`text-[12px] ml-1`, { color: V.textMuted }]}>
              Пользователи не найдены
            </Text>
          ) : null}
          {handleResults.map((row) => (
            <TouchableOpacity
              key={row.id}
              onPress={() => onOpenContact(row.handle)}
              style={[
                tw`flex-row items-center py-3 px-3 rounded-[10px] mb-1`,
                { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border },
              ]}
            >
              <ContactsAvatarCircle name={row.handle} />
              <View style={tw`flex-1`}>
                <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]}>
                  @{row.handle}
                </Text>
              </View>
              <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]}>Открыть</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
