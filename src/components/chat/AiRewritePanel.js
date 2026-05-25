import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import SafeBlurView from '../SafeBlurView';
import { V } from '../../theme';
import { requestAiRewrite } from '../../lib/aiRewrite';

const STYLES = [
  { id: 'formal', label: 'Формально', emoji: '👔' },
  { id: 'short', label: 'Коротко', emoji: '✂️' },
  { id: 'soft', label: 'Мягче', emoji: '🕊️' },
  { id: 'bold', label: 'Дерзко', emoji: '🔥' },
  { id: 'fix', label: 'Исправить', emoji: '✅' }];

/**
 * Bottom sheet: ИИ-переписывание текста (Groq через Supabase Edge).
 */
export default function AiRewritePanel({ visible, onRequestClose, sourceText, onApply }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rewritten, setRewritten] = useState('');

  useEffect(() => {
    if (visible) {
      setLoading(false);
      setError(null);
      setRewritten('');
    }
  }, [visible, sourceText]);

  const runRewrite = useCallback(
    async (style) => {
      setLoading(true);
      setError(null);
      setRewritten('');
      try {
        const out = await requestAiRewrite({ style, sourceText });
        setRewritten(out);
      } catch (e) {
        setError(e?.message || 'Сеть недоступна');
      } finally {
        setLoading(false);
      }
    },
    [sourceText]
  );

  const handleApply = useCallback(() => {
    if (rewritten) {
      onApply(rewritten);
    }
    onRequestClose();
  }, [onApply, onRequestClose, rewritten]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onRequestClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <View
          style={[
            styles.sheetWrap,
            {
              paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View style={styles.sheetClip}>
            <SafeBlurView
              intensity={Platform.OS === 'ios' ? 48 : 32}
              tint="dark"
              blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['rgba(13,15,20,0.72)', V.bgApp]}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: V.border,
                  borderBottomWidth: 0 }]}
            />
            <View style={styles.sheetInner}>
              <Text style={styles.title}>ИИ-редактор</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stylesRow}
                keyboardShouldPersistTaps="handled"
              >
                {STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => runRewrite(s.id)}
                    disabled={loading}
                    style={[
                      styles.chip,
                      {borderColor: V.sageBorder, backgroundColor: 'rgba(90,158,154,0.06)'}]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.chipEmoji}>{s.emoji}</Text>
                    <Text style={styles.chipLabel}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loading && (
                <View style={styles.loaderRow}>
                  <ActivityIndicator color={V.accentSage} />
                </View>
              )}

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <Text style={styles.textOriginal}>{sourceText}</Text>

              {rewritten ? <Text style={styles.textResult}>{rewritten}</Text> : null}

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={onRequestClose}
                  style={[styles.btn, styles.btnGhost, { }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnGhostText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleApply}
                  style={[styles.btn, styles.btnPrimary, { }]}
                  activeOpacity={0.85}
                  disabled={!rewritten}
                >
                  <Text style={styles.btnPrimaryText}>Применить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrap: {
    maxHeight: '88%' },
  sheetClip: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: V.bgApp },
  sheetInner: {
    paddingHorizontal: 18,
    paddingTop: 18 },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: V.textPrimary,
    marginBottom: 14
  },
  stylesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 4 },
  chipEmoji: {
    fontSize: 15,
    marginRight: 6
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: V.textPrimary
  },
  loaderRow: {
    alignItems: 'center',
    paddingVertical: 8 },
  errorText: {
    fontSize: 13,
    fontWeight: '400',
    color: V.dangerMuted,
    marginBottom: 8
  },
  textOriginal: {
    fontSize: 15,
    fontWeight: '400',
    color: V.textSecondary,
    marginBottom: 12
  },
  textResult: {
    fontSize: 15,
    fontWeight: '400',
    color: V.textPrimary,
    marginBottom: 16
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    paddingBottom: 4 },
  btn: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
    minWidth: 100,
    alignItems: 'center' },
  btnGhost: {
    backgroundColor: V.hoverBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '400',
    color: V.textSecondary
  },
  btnPrimary: {
    backgroundColor: V.btnPrimaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: V.accentSage
  } });
