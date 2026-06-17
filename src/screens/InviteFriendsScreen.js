import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { V, SEARCH_FIELD_LAYOUT, SEARCH_CHATS_CAPSULE_RADIUS } from '../theme';
import TabBackground from '../components/TabBackground';
import { ArrowLeft, Copy, Forward } from '../icons/lucideIcons';
import InviteQrBlock from '../components/InviteQrBlock';
import { generateInviteCode } from '../utils/inviteCode';
import { buildInviteQrPayload } from '../utils/inviteDeepLink';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';
import { profileStackGoBack, useProfileStackBackHandler } from '../lib/profileStackGoBack';

const INSERT_RETRIES = 3;
const INVITE_VALID_DAYS = 7;
const BTN_H = SEARCH_FIELD_LAYOUT.chatsHeight;
const BTN_RADIUS = SEARCH_CHATS_CAPSULE_RADIUS;
const CARD_RADIUS = 12;
const ACTION_BTN_H = 36;

function formatExpires(iso) {
  if (!iso) return 'Без срока';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function isInviteActive(row) {
  if (!row) return false;
  const maxUses = Number(row.max_uses) || 1;
  if (Number(row.uses_count) >= maxUses) return false;
  const exp = new Date(row.expires_at);
  return !Number.isNaN(exp.getTime()) && exp.getTime() > Date.now();
}

/** Текст для системного «Поделиться»: почта, мессенджеры, SMS и т.д. */
function buildInviteShareMessage(code, expiresAtIso) {
  const link = buildInviteQrPayload(code);
  const until = formatExpires(expiresAtIso);
  const parts = [
    'Привет! Приглашаю в Vault Messenger (нарды и чаты).',
    `Код приглашения: ${code}`,
  ];
  if (link) parts.push(`Ссылка для приложения: ${link}`);
  parts.push(
    'Как зарегистрироваться: установи приложение → экран входа → «Регистрация» → введи код вручную или отсканируй QR с экрана «Приглашения» у того, кто пригласил.',
    `Срок кода: до ${until}.`,
  );
  return parts.join('\n\n');
}

function ActiveInviteCard({ invite, onCopy, onShare }) {
  return (
    <View style={styles.inviteBlock}>
      <View style={styles.card}>
        <View style={styles.cardMain}>
          <Text style={styles.codeText}>{invite.code}</Text>
          <Text style={styles.codeMeta}>
            Действует до {formatExpires(invite.expires_at)} · одно использование
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => onCopy(invite.code)}
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            accessibilityLabel="Скопировать код"
            activeOpacity={0.85}
          >
            <Copy size={16} color={V.accentSage} strokeWidth={1.5} />
            <Text style={styles.actionBtnPrimaryText}>Копировать</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onShare(invite.code, invite.expires_at)}
            style={[styles.actionBtn, styles.actionBtnGhost]}
            accessibilityLabel="Отправить приглашение"
            activeOpacity={0.85}
          >
            <Forward size={16} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={styles.actionBtnGhostText}>Отправить…</Text>
          </TouchableOpacity>
        </View>
      </View>
      <InviteQrBlock code={invite.code} />
    </View>
  );
}

export default function InviteFriendsScreen({ navigation }) {
  useProfileStackBackHandler(navigation);
  const [activeInvite, setActiveInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const headerLayout = useMessengerHeaderLayout();

  const loadActiveInvite = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        setActiveInvite(null);
        return;
      }

      const nowIso = new Date().toISOString();

      // Сгоревшие коды убираем из БД (best effort; RLS — только свои).
      await supabase
        .from('invite_codes')
        .delete()
        .eq('created_by', uid)
        .or(`expires_at.lt.${nowIso},uses_count.gte.1`);

      const { data, error } = await supabase
        .from('invite_codes')
        .select('id, code, expires_at, max_uses, uses_count, created_at')
        .eq('created_by', uid)
        .gt('expires_at', nowIso)
        .eq('uses_count', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setActiveInvite(isInviteActive(data) ? data : null);
    } catch (e) {
      setActiveInvite(null);
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить приглашение');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActiveInvite();
    }, [loadActiveInvite]),
  );

  const copyCode = async (code) => {
    const s = String(code ?? '').trim();
    if (!s) {
      Alert.alert('Копирование', 'Код пуст — создай приглашение заново.');
      return;
    }
    try {
      await Clipboard.setStringAsync(s);
      Alert.alert('Скопировано', 'Код скопирован в буфер обмена.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось скопировать.');
    }
  };

  const shareInvite = async (code, expiresAtIso) => {
    const s = String(code ?? '').trim();
    if (!s) {
      Alert.alert('Отправка', 'Код пуст — создай приглашение заново.');
      return;
    }
    try {
      await Share.share({
        title: 'Приглашение Vault Messenger',
        message: buildInviteShareMessage(s, expiresAtIso),
      });
    } catch (e) {
      if (e?.name === 'AbortError') return;
      Alert.alert('Ошибка', e?.message || 'Не удалось открыть меню «Поделиться».');
    }
  };

  const createInvite = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert('Сессия', 'Войдите в аккаунт, чтобы создать приглашение.');
      return;
    }

    if (activeInvite) {
      Alert.alert(
        'Код ещё действует',
        `Текущее приглашение активно до ${formatExpires(activeInvite.expires_at)}. После использования или истечения срока можно создать новое.`,
      );
      return;
    }

    const expiresAt = new Date(
      Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    setCreating(true);
    try {
      let lastErr = null;
      for (let attempt = 0; attempt < INSERT_RETRIES; attempt++) {
        const code = generateInviteCode();
        const { error } = await supabase.from('invite_codes').insert({
          code,
          created_by: uid,
          max_uses: 1,
          expires_at: expiresAt,
        });
        if (!error) {
          await loadActiveInvite();
          try {
            await Clipboard.setStringAsync(code);
          } catch {
            /* буфер — не критично для создания кода */
          }
          Alert.alert(
            'Готово',
            `Код скопирован в буфер. Действует ${INVITE_VALID_DAYS} дней (до ${formatExpires(expiresAt)}), одно использование.`,
          );
          return;
        }
        lastErr = error;
        if (String(error.code) !== '23505') break;
      }
      Alert.alert('Не удалось создать', lastErr?.message || 'Повторите позже.');
    } finally {
      setCreating(false);
    }
  };

  const hasActiveInvite = !!activeInvite;

  return (
    <TabBackground>
      <View style={styles.screen}>
        <View style={[headerLayout.containerStyle, styles.header]}>
          <TouchableOpacity
            onPress={() => profileStackGoBack(navigation)}
            style={[styles.backBtn, { minHeight: headerLayout.contentMinHeight }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={styles.backText}>Назад</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Приглашения</Text>
          <Text style={styles.lead}>
            Одно приглашение на {INVITE_VALID_DAYS} дней и одну регистрацию. После использования или
            истечения срока код сгорает — можно создать новый. «Отправить…» открывает системное меню.
            QR сканируется на экране «Регистрация» при входе.
          </Text>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={V.textMuted} />
            </View>
          ) : hasActiveInvite ? (
            <ActiveInviteCard
              invite={activeInvite}
              onCopy={copyCode}
              onShare={shareInvite}
            />
          ) : (
            <>
              <Text style={styles.emptyText}>
                Активного приглашения нет. Создай код и отправь другу.
              </Text>
              <TouchableOpacity
                onPress={createInvite}
                disabled={creating}
                style={[styles.createBtn, creating && styles.createBtnBusy]}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator color={V.accentSage} />
                ) : (
                  <Text style={styles.createBtnText}>Создать приглашение</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </TabBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'transparent',
  },
  backBtn: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: V.textSecondary,
    marginLeft: 8,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: V.textPrimary,
    marginBottom: 8,
  },
  lead: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: V.textSecondary,
    marginBottom: 20,
  },
  createBtn: {
    height: BTN_H,
    borderRadius: BTN_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.btnPrimaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
    marginTop: 8,
  },
  createBtnBusy: {
    opacity: 0.6,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: V.accentSage,
  },
  loaderWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    color: V.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  inviteBlock: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: CARD_RADIUS,
    backgroundColor: V.glassNeutralBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  cardMain: {
    flex: 1,
    marginRight: 8,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
  },
  codeMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: V.textMuted,
    marginTop: 4,
  },
  cardActions: {
    alignItems: 'flex-end',
  },
  actionBtn: {
    height: ACTION_BTN_H,
    borderRadius: ACTION_BTN_H / 2,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtnPrimary: {
    backgroundColor: V.btnPrimaryBg,
    borderColor: V.sageBorder,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: V.accentSage,
    marginLeft: 6,
  },
  actionBtnGhost: {
    backgroundColor: V.hoverBg,
    borderColor: V.border,
    marginTop: 8,
  },
  actionBtnGhostText: {
    fontSize: 12,
    fontWeight: '500',
    color: V.textSecondary,
    marginLeft: 6,
  },
});
