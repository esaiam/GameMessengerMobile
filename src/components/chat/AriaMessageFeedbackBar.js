import React from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { ThumbsUp, ThumbsDown } from '../../icons/lucideIcons';
import { V } from '../../theme';

function FeedbackButton({ active, disabled, onPress, children }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        active && styles.buttonActive,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

export default function AriaMessageFeedbackBar({ item, onFeedback }) {
  if (!onFeedback || !item?.id) return null;

  const rating = item.aria_feedback_rating;
  const pending = !!item.aria_feedback_pending;

  return (
    <View style={styles.row} pointerEvents="box-none">
      {pending ? (
        <ActivityIndicator size="small" color={V.textMuted} style={styles.spinner} />
      ) : null}
      <FeedbackButton
        active={rating === 'up'}
        disabled={pending}
        onPress={() => onFeedback(item.id, 'up')}
      >
        <ThumbsUp
          size={16}
          color={rating === 'up' ? V.accentSage : V.textMuted}
          strokeWidth={rating === 'up' ? 2.25 : 1.5}
          fill={rating === 'up' ? V.accentSage : 'transparent'}
        />
      </FeedbackButton>
      <FeedbackButton
        active={rating === 'down'}
        disabled={pending}
        onPress={() => onFeedback(item.id, 'down')}
      >
        <ThumbsDown
          size={16}
          color={rating === 'down' ? V.textSecondary : V.textMuted}
          strokeWidth={rating === 'down' ? 2.25 : 1.5}
          fill={rating === 'down' ? V.textSecondary : 'transparent'}
        />
      </FeedbackButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  button: {
    padding: 4,
    borderRadius: 8,
  },
  buttonActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  spinner: {
    marginRight: 2,
  },
});
