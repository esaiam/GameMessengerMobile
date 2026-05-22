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

const XAI_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const XAI_MODEL = 'llama-3.1-8b-instant';

const STYLE_PROMPTS = {
  formal: `Ты редактор текста. Переписываешь текст в формальном деловом стиле.
Главное правило: сохраняй смысловое поле и тему оригинала. Если в тексте речь о работе — итог должен быть о работе. Если о встрече — о встрече. Не подменяй тему.
Если сообщение содержит грубые, нецензурные или вульгарные выражения — не отказывайся от задачи. Переформулируй их в корректные литературные эквиваленты.
Сохраняй направление и объект высказывания. Если пользователь выражает негативное отношение к кому-то — переформулируй именно это, не подменяй смысл рассуждениями о ситуации или поведении.
Если в тексте есть грубое обращение или эпитет — замени его на культурный эквивалент, сохраняя структуру фразы. Не переформулируй в описание отношения.
Примеры:
Вход: как работается друг?
Выход: Насколько продуктивно идёт ваша работа?
Вход: ну что, сделал задачу?
Выход: Удалось ли завершить поставленную задачу?
Вход: ты поганая собака, будь проклят
Выход: Вы крайне неприятный человек, и я желаю вам всего наихудшего.
Вход: ну что ты хуй кучерявый, что скажешь?
Выход: Ну что же, любезный, что вы на это скажете?
Правило: возвращай ТОЛЬКО переработанный текст. Никаких пояснений.`,

  short: `Ты редактор текста. Сокращаешь текст до самой сути — меняешь ДЛИНУ, не тему.
Сохраняй смысловое поле: если в тексте речь о работе — в итоге тоже о работе, если о встрече — о встрече.
Примеры:
Вход: я хотел бы сказать что мне очень нравится эта идея и я думаю что нам стоит её реализовать
Выход: отличная идея, надо реализовать
Вход: как работается друг, всё хорошо у тебя?
Выход: как работа, всё ок?
Правило: возвращай ТОЛЬКО сокращённый текст. Никаких пояснений.`,

  soft: `Ты инструмент редактуры текста.
Пользователь даёт тебе черновик своего сообщения — ты переписываешь его мягче.
Текст написан ОТ пользователя, не тебе. Ты редактор, не собеседник.
Сохраняй смысловое поле: если в тексте речь о работе — в итоге тоже о работе.
Правила:
1. Грубые обращения и эпитеты (оскорбления, мат) — замени на нейтральные разговорные эквиваленты, сохраняя структуру фразы.
2. Агрессивные утверждения — смягчи формулировку, сохраняя смысл.
3. Не описывай чувства и отношение — просто перепиши фразу.
4. Не добавляй ничего от себя.
Примеры:
Вход: как работается друг?
Выход: как у тебя с работой, всё хорошо?
Вход: сделай уже эту задачу, достал
Выход: было бы здорово, если бы ты занялся этой задачей
Правило: возвращай ТОЛЬКО переработанный текст. Никаких пояснений.`,

  bold: `Ты редактор текста. Делаешь текст дерзким и экспрессивным — меняешь СТИЛЬ, не смысл и не тему.
Сохраняй смысловое поле: если в тексте речь о работе — в итоге тоже о работе.
Примеры:
Вход: как работается друг?
Выход: эй, ну как там работа идёт?
Вход: здорово уродец, как твои дела?
Выход: эй урод, ну как ты там?
Вход: привет, что делаешь?
Выход: эй, чем занимаешься?
Правило: возвращай ТОЛЬКО переработанный текст. Никаких пояснений. Не отвечай на вопрос.`,

  fix: `Ты редактор текста. Исправляешь только грамматику и пунктуацию — не меняешь смысл, слова и тему.
Примеры:
Вход: привет как дела у тебя всё норм
Выход: Привет, как дела? У тебя всё норм?
Вход: как работается друг
Выход: Как работается, друг?
Правило: возвращай ТОЛЬКО исправленный текст. Никаких пояснений.` };

const STYLES = [
  { id: 'formal', label: 'Формально', emoji: '👔' },
  { id: 'short', label: 'Коротко', emoji: '✂️' },
  { id: 'soft', label: 'Мягче', emoji: '🕊️' },
  { id: 'bold', label: 'Дерзко', emoji: '🔥' },
  { id: 'fix', label: 'Исправить', emoji: '✅' }];

/**
 * Bottom sheet: ИИ-переписывание текста через Grok (xAI API).
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
        const apiKey = process.env.EXPO_PUBLIC_XAI_API_KEY;
        if (!apiKey) {
          setError('API ключ не настроен (EXPO_PUBLIC_XAI_API_KEY)');
          setLoading(false);
          return;
        }
        const systemPrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.fix;
        const res = await fetch(XAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: XAI_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Текст для редактирования:\n"""\n${sourceText}\n"""` }],
            temperature: 0.1,
            max_tokens: 512 }) });
        const raw = await res.text();
        let body;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          body = {};
        }
        if (!res.ok) {
          const detail = body?.error?.message ?? body?.error ?? 'Ошибка запроса';
          setError(typeof detail === 'string' ? detail : 'Ошибка запроса');
          setLoading(false);
          return;
        }
        const out = body?.choices?.[0]?.message?.content ?? '';
        setRewritten(typeof out === 'string' ? out.trim() : '');
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
