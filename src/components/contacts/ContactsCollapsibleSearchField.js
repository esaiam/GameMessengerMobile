import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import tw from 'twrnc';
import { Search } from '../../icons/lucideIcons';
import { SEARCH_FIELD_LAYOUT, V } from '../../theme';

const TYPEWRITER_LETTER_MS = 280;
const TYPEWRITER_HOLD_MS = 2200;

function useTypewriterLabel(text, enabled) {
  const [visible, setVisible] = useState('');

  useEffect(() => {
    if (!enabled) {
      setVisible('');
      return undefined;
    }

    let cancelled = false;
    let index = 0;
    let timeoutId;

    const tick = () => {
      if (cancelled) return;
      setVisible(text.slice(0, index + 1));
      if (index < text.length - 1) {
        index += 1;
        timeoutId = setTimeout(tick, TYPEWRITER_LETTER_MS);
        return;
      }
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        index = 0;
        setVisible('');
        timeoutId = setTimeout(tick, TYPEWRITER_LETTER_MS);
      }, TYPEWRITER_HOLD_MS);
    };

    timeoutId = setTimeout(tick, TYPEWRITER_LETTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [text, enabled]);

  return visible;
}

/** Как ChatsCollapsibleSearchField (поиск + typewriter). */
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
  placeholder = 'Поиск по имени или @handle',
}) {
  const [focused, setFocused] = useState(false);
  const showTypewriter = !query && !focused;
  const typewriterLabel = useTypewriterLabel(placeholder, showTypewriter);

  return (
    <Animated.View animatedProps={wrapAnimatedProps} style={wrapStyle}>
      <Animated.View style={innerStyle}>
        <View style={{ marginBottom: searchBottomSpacingPx }}>
          <View
            style={[
              tw`flex-row items-center`,
              {
                minHeight: searchFieldHeight,
                paddingHorizontal: SEARCH_FIELD_LAYOUT.rowPaddingH,
                backgroundColor: 'transparent',
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: V.border,
              },
            ]}
          >
            <Search
              size={14}
              strokeWidth={1.5}
              color={V.textMuted}
              style={{ marginRight: 8, flexShrink: 0 }}
            />
            <View style={styles.inputWrap}>
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
                placeholder=""
                value={query}
                onChangeText={onChangeQuery}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={(e) => {
                  setFocused(true);
                  onFocus?.(e);
                }}
                onBlur={(e) => {
                  setFocused(false);
                  onBlur?.(e);
                }}
              />
              {showTypewriter ? (
                <View style={styles.typewriterOverlay} pointerEvents="none">
                  <Text style={styles.typewriterText} numberOfLines={1}>
                    {typewriterLabel}
                  </Text>
                </View>
              ) : null}
            </View>
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
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  typewriterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  typewriterText: {
    fontSize: 15,
    color: V.sageFocus,
  },
});
