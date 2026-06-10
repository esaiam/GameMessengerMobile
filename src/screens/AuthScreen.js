import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import tw from 'twrnc';
import { Dices } from '../icons/lucideIcons';
import { V } from '../theme';
import { supabase } from '../lib/supabase';
import {
  VAULT_PENDING_INVITE_KEY,
  normalizePendingInviteCode,
  serializePendingInvite } from '../utils/inviteRedeem';
import {
  AUTH_RECOVERY_REDIRECT_URL,
  AUTH_CONFIRM_REDIRECT_URL,
} from '../utils/authRecoveryDeepLink';

export default function AuthScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();

  useEffect(() => {
    const c = route.params?.scannedCode;
    if (typeof c === 'string' && c.length > 0) {
      setInviteCode(normalizePendingInviteCode(c));
      navigation.setParams({ scannedCode: undefined });
    }
  }, [route.params?.scannedCode, navigation]);

  const onResetPassword = async () => {
    if (!trimmedEmail) {
      Alert.alert('Внимание', 'Введите email.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: AUTH_RECOVERY_REDIRECT_URL });
      if (error) throw error;
      Alert.alert(
        'Сброс пароля',
        'Письмо со ссылкой для сброса пароля отправлено на ' + trimmedEmail,
        [{ text: 'Ок', onPress: () => setMode('signIn') }]
      );
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось отправить письмо');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (mode === 'resetPassword') {
      return onResetPassword();
    }
    if (!trimmedEmail || !password) {
      Alert.alert('Внимание', 'Введите email и пароль.');
      return;
    }
    let signupInviteNorm = null;
    if (mode === 'signUp') {
      signupInviteNorm = normalizePendingInviteCode(inviteCode);
      if (!signupInviteNorm) {
        Alert.alert(
          'Регистрация',
          'Новый аккаунт только по приглашению. Введите код из раздела «Приглашения» в профиле.'
        );
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Пароли не совпадают');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password });
        if (error) throw error;
      } else {
        await AsyncStorage.setItem(
          VAULT_PENDING_INVITE_KEY,
          serializePendingInvite(trimmedEmail, signupInviteNorm)
        );
        try {
          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              emailRedirectTo: AUTH_CONFIRM_REDIRECT_URL
            }
          });
          if (error) throw error;
          if (!data.session) {
            Alert.alert(
              'Регистрация',
              'Подтвердите email по ссылке из письма. Код приглашения будет применён автоматически после первого входа.'
            );
          } else {
            Alert.alert('Регистрация', 'Аккаунт создан, приглашение применяется…');
          }
        } catch (e) {
          await AsyncStorage.removeItem(VAULT_PENDING_INVITE_KEY);
          throw e;
        }
      }
    } catch (e) {
      const msg = e?.message || 'Не удалось выполнить запрос';
      Alert.alert('Ошибка', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[tw`flex-1`, { backgroundColor: V.bgApp }]}
    >
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <View style={tw`flex-row items-center mb-2`}>
          <Dices size={20} color={V.accentGold} strokeWidth={1.5} style={tw`mr-2`} />
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]}>Нарды</Text>
        </View>
        <Text style={[tw`text-[13px] mb-8`, { color: V.textSecondary, lineHeight: 20 }]}>
          Вход по email для синхронизации профиля
        </Text>

        {mode !== 'resetPassword' ? (
          <View style={tw`w-full flex-row mb-4 rounded-[10px] overflow-hidden`}>
            {['signIn', 'signUp'].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  if (mode !== m) setConfirmPassword('');
                  setMode(m);
                }}
                style={[
                  tw`flex-1 py-2.5 items-center`,
                  {
                    backgroundColor: mode === m ? V.bgElevated : V.bgSurface,
                    borderWidth: 0.5,
                    borderColor: V.border }]}
              >
                <Text
                  style={[
                    tw`text-[13px] font-medium`,
                    { color: mode === m ? V.accentSage : V.textMuted }]}
                >
                  {m === 'signIn' ? 'Вход' : 'Регистрация'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={tw`w-full mb-4`}>
            <Text style={[tw`text-[15px] font-medium text-center`, { color: V.textPrimary }]}>
              Сброс пароля
            </Text>
            <Text style={[tw`text-[12px] text-center mt-1`, { color: V.textSecondary }]}>
              Введите email — пришлём ссылку для сброса
            </Text>
          </View>
        )}

        <View style={tw`w-full mb-4`}>
          <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
            Email
          </Text>
          <TextInput
            style={[
              tw`w-full px-4 py-3.5 text-[16px] rounded-[10px]`,
              {
                backgroundColor: V.bgSurface,
                color: V.textPrimary,
                borderWidth: 0.5,
                borderColor: V.border }]}
            placeholder="you@example.com"
            placeholderTextColor={V.textGhost}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
          />
        </View>

        {mode !== 'resetPassword' ? (
          <View style={tw`w-full ${mode === 'signUp' ? 'mb-4' : 'mb-2'}`}>
            <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
              Пароль
            </Text>
            <TextInput
              style={[
                tw`w-full px-4 py-3.5 text-[16px] rounded-[10px]`,
                {
                  backgroundColor: V.bgSurface,
                  color: V.textPrimary,
                  borderWidth: 0.5,
                  borderColor: V.border }]}
              placeholder="••••••••"
              placeholderTextColor={V.textGhost}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
          </View>
        ) : null}

        {mode === 'signIn' ? (
          <TouchableOpacity
            onPress={() => setMode('resetPassword')}
            disabled={busy}
            style={tw`w-full items-end mb-4`}
          >
            <Text style={[tw`text-[12px]`, { color: V.textMuted }]}>Забыли пароль?</Text>
          </TouchableOpacity>
        ) : mode !== 'resetPassword' ? (
          <View style={tw`mb-4`} />
        ) : null}

        {mode === 'signUp' ? (
          <View style={tw`w-full mb-4`}>
            <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
              Подтверждение пароля
            </Text>
            <TextInput
              style={[
                tw`w-full px-4 py-3.5 text-[16px] rounded-[10px]`,
                {
                  backgroundColor: V.bgSurface,
                  color: V.textPrimary,
                  borderWidth: 0.5,
                  borderColor: V.border }]}
              placeholder="••••••••"
              placeholderTextColor={V.textGhost}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
          </View>
        ) : null}

        {mode === 'signUp' ? (
          <View style={tw`w-full mb-6`}>
            <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
              Код приглашения
            </Text>
            <TextInput
              style={[
                tw`w-full px-4 py-3.5 text-[16px] rounded-[10px]`,
                {
                  backgroundColor: V.bgSurface,
                  color: V.textPrimary,
                  borderWidth: 0.5,
                  borderColor: V.border }]}
              placeholder="Вставьте код из профиля"
              placeholderTextColor={V.textGhost}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(normalizePendingInviteCode(t))}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Text style={[tw`text-[11px] mt-2 ml-1`, { color: V.textMuted, lineHeight: 16 }]}>
              Новый аккаунт только со инвайтом. Регистрация без кода недоступна. Для входа существующего
              пользователя переключитесь на «Вход» — код не нужен.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('InviteScan')}
              disabled={busy}
              style={tw`mt-3 py-2`}
            >
              <Text style={[tw`text-[13px] font-medium text-center`, { color: V.accentSage }]}>
                Сканировать QR приглашения
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            tw`w-full rounded-[10px] py-3.5 items-center flex-row justify-center`,
            {
              backgroundColor: V.btnPrimaryBg,
              borderWidth: 0.5,
              borderColor: V.accentSage,
              opacity: busy ? 0.6 : 1 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={V.accentSage} />
          ) : (
            <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>
              {mode === 'signIn'
                ? 'Войти'
                : mode === 'resetPassword'
                ? 'Отправить письмо'
                : 'Создать аккаунт'}
            </Text>
          )}
        </TouchableOpacity>

        {mode === 'resetPassword' ? (
          <TouchableOpacity
            onPress={() => setMode('signIn')}
            disabled={busy}
            style={tw`mt-4 py-2`}
          >
            <Text style={[tw`text-[13px] text-center`, { color: V.textMuted }]}>
              Назад к входу
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
