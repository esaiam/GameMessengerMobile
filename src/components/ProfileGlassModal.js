import React from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeBlurView from './SafeBlurView';
import { V } from '../theme';

export const PROFILE_MODAL_RADIUS = 20;
const CARD_H_PAD = 24;

/**
 * Центрированная стеклянная карточка для экрана Профиль (эталон blur — AiRewritePanel).
 */
export default function ProfileGlassModal({
  visible,
  onClose,
  children,
  keyboardAvoiding = false }) {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const cardMaxW = Math.min(340, windowW - CARD_H_PAD * 2);

  const card = (
    <View
      style={[
        styles.centerWrap,
        {
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: CARD_H_PAD }]}
      pointerEvents="box-none"
    >
      <View style={[styles.cardOuter, { maxWidth: cardMaxW }]}>
        <View style={styles.cardClip}>
          <SafeBlurView
            intensity={Platform.OS === 'ios' ? 48 : 32}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(13,15,20,0.55)', 'rgba(26,29,36,0.78)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: PROFILE_MODAL_RADIUS,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border }]}
          />
          <View style={styles.cardInner}>{children}</View>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        />
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            {card}
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.flex} pointerEvents="box-none">
            {card}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1 },
  flex: {
    flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)' },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center' },
  cardOuter: {
    width: '100%' },
  cardClip: {
    borderRadius: PROFILE_MODAL_RADIUS,
    overflow: 'hidden' },
  cardInner: {
    paddingHorizontal: 14,
    paddingVertical: 12 } });
