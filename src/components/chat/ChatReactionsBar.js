import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { V } from '../../theme';
import {
  REACTION_OVERLAY_BOTTOM,
  REACTION_OVERLAY_LEFT } from './messageBubbleLayoutConstants';

/** 0 → snap (overshoot в spring) → покой на scale 1. */
function playReactionPopIn(scale) {
  scale.setValue(0);
  Animated.spring(scale, {
    toValue: 1,
    friction: 5,
    tension: 320,
    useNativeDriver: true }).start();
}

const ReactionChip = React.memo(function ReactionChip({ emoji, count, onPress }) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    playReactionPopIn(scale);
  }, [emoji, scale]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <Animated.View style={[styles.chip, { transform: [{ scale }] }]}>
        <Text style={styles.emoji}>{emoji}</Text>
        {count > 1 ? <Text style={styles.count}>{count}</Text> : null}
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function ChatReactionsBar({ reactions, onReact }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {Object.entries(reactions).map(([emoji, users]) => (
        <ReactionChip
          key={emoji}
          emoji={emoji}
          count={users.length}
          onPress={() => onReact(emoji)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: REACTION_OVERLAY_LEFT,
    bottom: REACTION_OVERLAY_BOTTOM,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    maxWidth: '92%',
    zIndex: 4,
    elevation: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: V.bgElevated },
  emoji: {
    fontSize: 15,
    lineHeight: 17 },
  count: {
    fontSize: 10,
    lineHeight: 12,
    marginLeft: 3,
    color: V.textSecondary,
    fontWeight: '500' } });
