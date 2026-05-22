import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBackground from '../TabBackground';
import { useTamagotchi } from '../../hooks/useTamagotchi';
import { getAnimationForState, getRelationshipLabel } from '../../lib/tamagotchi/getAnimationForState';
import { V } from '../../theme';

const ACTIONS = [
  { id: 'feed', emoji: '🍕', label: 'Кормить' },
  { id: 'play', emoji: '🎮', label: 'Играть' },
  { id: 'pet', emoji: '🤝', label: 'Гладить' },
  { id: 'praise', emoji: '💬', label: 'Похвалить' },
  { id: 'heal', emoji: '💊', label: 'Лечить', needsHurt: true }];

function SpeechBubble({ text, style }) {
  if (!text) return null;
  return (
    <View style={[styles.bubble, style]}>
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  );
}

export default function TamagotchiScreen() {
  const insets = useSafeAreaInsets();
  const {
    state,
    loading,
    innerThought,
    pendingBubble,
    cooldownHint,
    buttonsDisabled,
    canHeal,
    performAction } = useTamagotchi();

  const { emoji, visual } = useMemo(() => getAnimationForState(state), [state]);
  const relationshipLabel = useMemo(
    () => getRelationshipLabel(state.relationship_level),
    [state.relationship_level]
  );
  const relPct = Math.round((state.relationship_level ?? 0) * 100);

  const visibleActions = ACTIONS.filter((a) => !a.needsHurt || canHeal);
  const speechText = innerThought || pendingBubble;

  return (
    <TabBackground>
      <View
        style={[
          styles.root,
          {paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16}]}
      >
        <Text style={styles.title}>Ария</Text>
        <Text style={styles.subtitle}>Твоё отражение настроения</Text>

        <View style={styles.characterZone}>
          <SpeechBubble text={speechText} style={styles.thoughtBubble} />
          <View style={styles.characterCircle}>
            {loading ? (
              <ActivityIndicator color={V.accentSage} />
            ) : (
              <Text style={styles.characterEmoji} accessibilityLabel={visual}>
                {emoji}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.relationshipBlock}>
          <View style={styles.relationshipRow}>
            <Text style={styles.relationshipLabel}>{relationshipLabel}</Text>
            <Text style={styles.relationshipPct}>{relPct}%</Text>
          </View>
          <View style={styles.relationshipTrack}>
            <View style={[styles.relationshipFill, { width: `${relPct}%` }]} />
          </View>
        </View>

        {cooldownHint ? (
          <Text style={styles.cooldownHint}>{cooldownHint}</Text>
        ) : null}

        <View style={styles.actionsRow}>
          {visibleActions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => performAction(action.id)}
              disabled={buttonsDisabled}
              style={({ pressed }) => [
                styles.actionBtn,
                buttonsDisabled && styles.actionBtnDisabled,
                pressed && !buttonsDisabled && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text style={styles.actionEmoji}>{action.emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center' },
  title: {
    color: V.textPrimary,
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 4
  },
  subtitle: {
    color: V.textSecondary,
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 24
  },
  characterZone: {
    flex: 1,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200 },
  characterCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: V.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    alignItems: 'center',
    justifyContent: 'center' },
  characterEmoji: {
    fontSize: 72,
    lineHeight: 80
  },
  thoughtBubble: {
    marginBottom: 16,
    maxWidth: '100%' },
  bubble: {
    backgroundColor: V.bgElevated,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 280 },
  bubbleText: {
    color: V.textPrimary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center'
  },
  relationshipBlock: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 20 },
  relationshipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8 },
  relationshipLabel: {
    color: V.textSecondary,
    fontSize: 13,
    fontWeight: '400'
  },
  relationshipPct: {
    color: V.textMuted,
    fontSize: 12,
    fontWeight: '400'
  },
  relationshipTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: V.bgElevated,
    overflow: 'hidden' },
  relationshipFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: V.accentSage,
    minWidth: 0 },
  cooldownHint: {
    color: V.accentGold,
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 12,
    textAlign: 'center'
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8 },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: V.bgSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    alignItems: 'center',
    justifyContent: 'center' },
  actionBtnPressed: {
    backgroundColor: V.bgElevated },
  actionBtnDisabled: {
    opacity: 0.45 },
  actionEmoji: {
    fontSize: 26,
    lineHeight: 30
  } });
