import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import tw from 'twrnc';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { V } from '../theme';
import TabBackground from '../components/TabBackground';
import { ArrowLeft, Copy, Forward } from '../icons/lucideIcons';
import InviteQrBlock from '../components/InviteQrBlock';
import { generateInviteCode } from '../utils/inviteCode';
import { buildInviteQrPayload } from '../utils/inviteDeepLink';
import { useMessengerHeaderLayout } from '../components/MessengerHeaderLayout';

const LIST_LIMIT = 10;
const INSERT_RETRIES = 3;
const INVITE_VALID_DAYS = 7;

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

/** Текст для системного «Поделиться»: почта, мессенджеры, SMS и т.д. */
function buildInviteShareMessage(code, expiresAtIso) {
  const link = buildInviteQrPayload(code);
  const until = formatExpires(expiresAtIso);
  const parts = [
    'Привет! Приглашаю в Vault Messenger (нарды и чаты).',
    `Код приглашения: ${code}`];
  if (link) parts.push(`Ссылка для приложения: ${link}`);
  parts.push(
    'Как зарегистрироваться: установи приложение → экран входа → «Регистрация» → введи код вручную или отсканируй QR с экрана «Приглашения» у того, кто пригласил.',
    `Срок кода: до ${until}.`
  );
  return parts.join('\n\n');
}

export default function InviteFriendsScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const headerLayout = useMessengerHeaderLayout();

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invite_codes')
        .select('id, code, expires_at, max_uses, uses_count, created_at')
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setRows([]);
      Alert.alert('Ошибка', e?.message || 'Не удалось загрузить приглашения');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCodes();
    }, [loadCodes])
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
        message: buildInviteShareMessage(s, expiresAtIso) });
    } catch (e) {
      if (e?.name === 'AbortError') return;
      Alert.alert('Ошибка', e?.message || 'Не удалось открыть меню «Поделиться».');
    }
  };

  const createInvite = async () => {
    const {
      data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert('Сессия', 'Войдите в аккаунт, чтобы создать приглашение.');
      return;
    }

    const expiresAt = new Date(
      Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000
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
          expires_at: expiresAt });
        if (!error) {
          await loadCodes();
          try {
            await Clipboard.setStringAsync(code);
          } catch {
            /* буфер — не критично для создания кода */
          }
          Alert.alert(
            'Готово',
            `Код добавлен в список и скопирован в буфер. Действует ${INVITE_VALID_DAYS} дней (до ${formatExpires(expiresAt)}).`
          );
          return;
        }
        lastErr = error;
        if (String(error.code) !== '23505') break;
      }
      Alert.alert(
        'Не удалось создать',
        lastErr?.message || 'Повторите позже.'
      );
    } finally {
      setCreating(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={tw`mb-3`}>
      <View
        style={[
          tw`flex-row items-center py-3 px-3 rounded-[12px]`,
          { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border }]}
      >
        <View style={tw`flex-1 mr-2`}>
          <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]}>
            {item.code}
          </Text>
          <Text style={[tw`text-[11px] mt-1`, { color: V.textMuted }]}>
            до {formatExpires(item.expires_at)} · использований {item.uses_count}/{item.max_uses}
          </Text>
        </View>
        <View style={tw`items-end`}>
          <TouchableOpacity
            onPress={() => copyCode(item.code)}
            style={[
              tw`rounded-[10px] px-3 py-2 flex-row items-center`,
              { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.accentSage }]}
            accessibilityLabel="Скопировать код"
          >
            <Copy size={16} color={V.accentSage} strokeWidth={1.5} />
            <Text style={[tw`text-[12px] font-medium ml-1.5`, { color: V.accentSage }]}>Копировать</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => shareInvite(item.code, item.expires_at)}
            style={[
              tw`rounded-[10px] px-3 py-2 flex-row items-center mt-2`,
              { backgroundColor: V.btnPrimaryBg, borderWidth: 0.5, borderColor: V.border }]}
            accessibilityLabel="Отправить приглашение"
          >
            <Forward size={16} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={[tw`text-[12px] font-medium ml-1.5`, { color: V.textSecondary }]}>Отправить…</Text>
          </TouchableOpacity>
        </View>
      </View>
      <InviteQrBlock code={item.code} />
    </View>
  );

  return (
    <TabBackground>
      <View style={[tw`flex-1`, {backgroundColor: 'transparent'}]}>
        <View style={[headerLayout.containerStyle, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ minHeight: headerLayout.contentMinHeight, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={18} color={V.textSecondary} strokeWidth={1.5} />
            <Text style={[tw`text-[14px] font-medium ml-2`, { color: V.textSecondary }]}>Назад</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-1 px-4`}>
          <Text style={[tw`text-[17px] font-medium mb-2`, { color: V.textPrimary }]}>Приглашения</Text>
          <Text style={[tw`text-[12px] mb-5`, { color: V.textSecondary, lineHeight: 18 }]}>
            Код для регистрации друга. Срок действия нового кода — {INVITE_VALID_DAYS} календарных дней с
            момента создания (указано в списке ниже). «Отправить…» открывает системное меню: почта, мессенджеры,
            SMS и другие приложения. Сканирование QR — в режиме «Регистрация» на экране входа (при
            необходимости выйди из аккаунта).
          </Text>

        <TouchableOpacity
          onPress={createInvite}
          disabled={creating}
          style={[
            tw`rounded-[10px] py-3.5 items-center flex-row justify-center mb-5`,
            {
              backgroundColor: V.btnPrimaryBg,
              borderWidth: 0.5,
              borderColor: V.accentSage,
              opacity: creating ? 0.6 : 1 }]}
        >
          {creating ? (
            <ActivityIndicator color={V.accentSage} />
          ) : (
            <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>Создать приглашение</Text>
          )}
        </TouchableOpacity>

        <Text style={[tw`text-[13px] font-medium mb-2`, { color: V.textSecondary }]}>
          Мои коды (последние {LIST_LIMIT})
        </Text>

          {loading ? (
            <View style={tw`py-8 items-center`}>
              <ActivityIndicator color={V.textMuted} />
            </View>
          ) : (
            <FlatList
              style={tw`flex-1`}
              data={rows}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={[tw`text-[13px] py-4`, { color: V.textMuted }]}>
                  Пока нет кодов. Нажми «Создать приглашение» выше.
                </Text>
              }
            />
          )}
        </View>
      </View>
    </TabBackground>
  );
}
