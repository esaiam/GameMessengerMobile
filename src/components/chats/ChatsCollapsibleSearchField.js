import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import SafeBlurView from '../SafeBlurView';
import tw from 'twrnc';
import { Search } from '../../icons/lucideIcons';
import {
  SEARCH_CHATS_CAPSULE_RADIUS,
  SEARCH_FIELD_LAYOUT,
  V,
} from '../../theme';
export default function ChatsCollapsibleSearchField({
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
}) {
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
                borderRadius: SEARCH_CHATS_CAPSULE_RADIUS,
                overflow: 'hidden',
                paddingHorizontal: SEARCH_FIELD_LAYOUT.rowPaddingH,
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
              placeholder="Поиск..."
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
          </SafeBlurView>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
