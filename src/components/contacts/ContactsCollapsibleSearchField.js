import React, { useCallback, useRef } from 'react';
import {
  Animated as RNAnimated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import SafeBlurView from '../SafeBlurView';
import tw from 'twrnc';
import { Search, UserPlus } from '../../icons/lucideIcons';
import {
  SEARCH_CONTACTS_CAPSULE_RADIUS,
  SEARCH_FIELD_LAYOUT,
  V,
} from '../../theme';

/**
 * Как ChatsCollapsibleSearchField + кнопка «пригласить» справа в капсуле (как в старом ContactsSearchHeader).
 */
export default function ContactsCollapsibleSearchField({
  searchFieldHeight,
  searchBottomSpacingPx,
  wrapAnimatedProps,
  wrapStyle,
  innerStyle,
  inputRef,
  query,
  onChangeQuery,
  onFocus,
  onBlur,
  onOpenInvite,
  placeholder = 'Поиск по имени или @handle',
}) {
  const inviteScaleX = useRef(new RNAnimated.Value(1)).current;
  const inviteScaleY = useRef(new RNAnimated.Value(1)).current;
  const inviteRunAnimRef = useRef(null);

  const onInvitePressIn = useCallback(() => {
    inviteRunAnimRef.current?.stop?.();
    inviteScaleX.stopAnimation?.();
    inviteScaleY.stopAnimation?.();
    inviteScaleX.setValue(1);
    inviteScaleY.setValue(1);

    const anim = RNAnimated.sequence([
      RNAnimated.parallel([
        RNAnimated.timing(inviteScaleX, {
          toValue: 1.08,
          duration: 95,
          useNativeDriver: true,
        }),
        RNAnimated.timing(inviteScaleY, {
          toValue: 0.84,
          duration: 95,
          useNativeDriver: true,
        }),
      ]),
      RNAnimated.parallel([
        RNAnimated.spring(inviteScaleX, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        RNAnimated.spring(inviteScaleY, {
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

  const inviteSize = searchFieldHeight;

  return (
    <Animated.View animatedProps={wrapAnimatedProps} style={wrapStyle}>
      <Animated.View style={innerStyle}>
        <View style={{ marginBottom: searchBottomSpacingPx }}>
          <SafeBlurView
            intensity={28}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
            style={[
              tw`flex-row items-center`,
              {
                minHeight: searchFieldHeight,
                borderRadius: SEARCH_CONTACTS_CAPSULE_RADIUS,
                overflow: 'hidden',
                paddingLeft: SEARCH_FIELD_LAYOUT.rowPaddingH,
                paddingRight: 0,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255,255,255,0.13)',
                backgroundColor: 'rgba(255,255,255,0.06)',
              },
            ]}
          >
            <Search
              size={14}
              strokeWidth={1.5}
              color={V.textMuted}
              style={{ marginRight: 8, flexShrink: 0 }}
            />
            <TextInput
              ref={inputRef}
              style={[
                tw`flex-1 text-[15px]`,
                {
                  color: V.textPrimary,
                  paddingVertical: 0,
                  height: searchFieldHeight,
                },
              ]}
              placeholder={placeholder}
              placeholderTextColor={V.textMuted}
              value={query}
              onChangeText={onChangeQuery}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={onFocus}
              onBlur={onBlur}
            />
            {!!query && (
              <TouchableOpacity
                onPress={() => onChangeQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={tw`ml-2`}
                accessibilityRole="button"
                accessibilityLabel="Очистить поиск"
              >
                <Text style={[tw`text-[18px]`, { color: V.textPrimary, lineHeight: 18 }]}>
                  ×
                </Text>
              </TouchableOpacity>
            )}

            <Pressable
              onPress={onOpenInvite}
              onPressIn={onInvitePressIn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Коды приглашений"
            >
              <RNAnimated.View
                style={{
                  width: inviteSize,
                  height: inviteSize,
                  borderRadius: inviteSize / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: V.sageSubtle,
                  transform: [{ scaleX: inviteScaleX }, { scaleY: inviteScaleY }],
                }}
              >
                <UserPlus size={16} color={V.accentSage} strokeWidth={1.5} />
              </RNAnimated.View>
            </Pressable>
          </SafeBlurView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
