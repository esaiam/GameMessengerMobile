import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Gamepad2 } from 'lucide-react-native/icons';
import SafeBlurView from '../components/SafeBlurView';
import { V } from '../theme';

const ICON_SIZE = 72;

export default function PokerHubScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.centerWrap}>
        <SafeBlurView
          intensity={20}
          tint="dark"
          blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
          style={styles.glassCard}
        >
          <View style={styles.glassTint} pointerEvents="none" />
          <View style={styles.cardInner}>
            <Gamepad2
              color={V.accentSage}
              size={ICON_SIZE}
              strokeWidth={1.5}
            />
            <Text style={styles.title}>Игры</Text>
            <Text style={styles.subtitle}>Скоро появятся новые игры</Text>
            <Text style={styles.footer}>Покер · Шахматы · Другие игры</Text>
          </View>
        </SafeBlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V.bgApp,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  glassCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: V.bgElevated,
    opacity: 0.22,
  },
  cardInner: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '500',
    color: V.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '400',
    color: V.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    marginTop: 24,
    fontSize: 11,
    fontWeight: '400',
    color: V.textMuted,
    textAlign: 'center',
  },
});
