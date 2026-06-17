import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PetrolShimmerText } from '../components/petrol/PetrolShimmer';
import { V, SEARCH_FIELD_LAYOUT, SEARCH_CHATS_CAPSULE_RADIUS } from '../theme';
import { supabase } from '../lib/supabase';
import {
  VAULT_PENDING_INVITE_KEY,
  normalizePendingInviteCode,
  serializePendingInvite,
} from '../utils/inviteRedeem';
import {
  AUTH_RECOVERY_REDIRECT_URL,
  AUTH_CONFIRM_REDIRECT_URL,
} from '../utils/authRecoveryDeepLink';

const INPUT_H = SEARCH_FIELD_LAYOUT.chatsHeight;
const INPUT_RADIUS = SEARCH_CHATS_CAPSULE_RADIUS;
const H_PAD = 32;

function AuthFieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function AuthTextInput(props) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={V.textGhost}
    />
  );
}

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
        redirectTo: AUTH_RECOVERY_REDIRECT_URL,
      });
      if (error) throw error;
      Alert.alert(
        'Сброс пароля',
        'Письмо со ссылкой для сброса пароля отправлено на ' + trimmedEmail,
        [{ text: 'Ок', onPress: () => setMode('signIn') }],
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
          'Новый аккаунт только по приглашению. Введите код из раздела «Приглашения» в профиле.',
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
          password,
        });
        if (error) throw error;
      } else {
        await AsyncStorage.setItem(
          VAULT_PENDING_INVITE_KEY,
          serializePendingInvite(trimmedEmail, signupInviteNorm),
        );
        try {
          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              emailRedirectTo: AUTH_CONFIRM_REDIRECT_URL,
            },
          });
          if (error) throw error;
          if (!data.session) {
            Alert.alert(
              'Регистрация',
              'Подтвердите email по ссылке из письма. Код приглашения будет применён автоматически после первого входа.',
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
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>Vault</Text>
          <PetrolShimmerText textStyle={styles.brandSubtitle}>SECURE SPACE</PetrolShimmerText>
          <Text style={styles.brandHint}>Чаты, нарды и синхронизация профиля</Text>
        </View>

        {mode !== 'resetPassword' ? (
          <View style={styles.modeSwitch}>
            {['signIn', 'signUp'].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  if (mode !== m) setConfirmPassword('');
                  setMode(m);
                }}
                style={[
                  styles.modeSegment,
                  mode === m ? styles.modeSegmentActive : styles.modeSegmentIdle,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.modeSegmentText,
                    { color: mode === m ? V.accentSage : V.textMuted },
                  ]}
                >
                  {m === 'signIn' ? 'Вход' : 'Регистрация'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.resetHeader}>
            <Text style={styles.resetTitle}>Сброс пароля</Text>
            <Text style={styles.resetHint}>Введите email — пришлём ссылку для сброса</Text>
          </View>
        )}

        <View style={styles.fieldBlock}>
          <AuthFieldLabel>Email</AuthFieldLabel>
          <AuthTextInput
            testID="auth-email-input"
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
          />
        </View>

        {mode !== 'resetPassword' ? (
          <View style={[styles.fieldBlock, mode === 'signUp' ? null : styles.fieldBlockTight]}>
            <AuthFieldLabel>Пароль</AuthFieldLabel>
            <AuthTextInput
              testID="auth-password-input"
              placeholder="••••••••"
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
            style={styles.forgotLink}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotLinkText}>Забыли пароль?</Text>
          </TouchableOpacity>
        ) : mode !== 'resetPassword' ? (
          <View style={styles.forgotSpacer} />
        ) : null}

        {mode === 'signUp' ? (
          <View style={styles.fieldBlock}>
            <AuthFieldLabel>Подтверждение пароля</AuthFieldLabel>
            <AuthTextInput
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
          </View>
        ) : null}

        {mode === 'signUp' ? (
          <View style={styles.inviteBlock}>
            <AuthFieldLabel>Код приглашения</AuthFieldLabel>
            <AuthTextInput
              placeholder="Вставьте код из профиля"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(normalizePendingInviteCode(t))}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
            <Text style={styles.inviteHint}>
              Новый аккаунт только со инвайтом. Регистрация без кода недоступна. Для входа
              существующего пользователя переключитесь на «Вход» — код не нужен.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('InviteScan')}
              disabled={busy}
              style={styles.qrLink}
              activeOpacity={0.7}
            >
              <Text style={styles.qrLinkText}>Сканировать QR приглашения</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          testID="auth-submit-button"
          style={[styles.submitBtn, busy && styles.submitBtnBusy]}
          onPress={onSubmit}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={V.accentSage} />
          ) : (
            <Text style={styles.submitBtnText}>
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
            style={styles.backLink}
            activeOpacity={0.7}
          >
            <Text style={styles.backLinkText}>Назад к входу</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V.bgChatsScreen,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: 32,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '300',
    letterSpacing: 0.06 * 17,
    color: V.textPrimary,
  },
  brandSubtitle: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 0.1 * 9,
    textTransform: 'uppercase',
  },
  brandHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    color: V.textSecondary,
    textAlign: 'center',
  },
  modeSwitch: {
    flexDirection: 'row',
    height: INPUT_H,
    borderRadius: INPUT_RADIUS,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  modeSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentActive: {
    backgroundColor: V.glassNeutralBg,
  },
  modeSegmentIdle: {
    backgroundColor: V.bgSurface,
  },
  modeSegmentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resetHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  resetTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: V.textPrimary,
  },
  resetHint: {
    fontSize: 12,
    fontWeight: '400',
    color: V.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  fieldBlock: {
    width: '100%',
    marginBottom: 16,
  },
  fieldBlockTight: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: V.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    width: '100%',
    height: INPUT_H,
    borderRadius: INPUT_RADIUS,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '400',
    color: V.textPrimary,
    backgroundColor: V.glassNeutralBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  forgotLink: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotLinkText: {
    fontSize: 12,
    fontWeight: '400',
    color: V.textMuted,
  },
  forgotSpacer: {
    marginBottom: 16,
  },
  inviteBlock: {
    width: '100%',
    marginBottom: 24,
  },
  inviteHint: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
    color: V.textMuted,
    marginTop: 8,
    marginLeft: 4,
  },
  qrLink: {
    marginTop: 12,
    paddingVertical: 8,
  },
  qrLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: V.accentSage,
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
    height: INPUT_H,
    borderRadius: INPUT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.btnPrimaryBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
  },
  submitBtnBusy: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: V.accentSage,
  },
  backLink: {
    marginTop: 16,
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '400',
    color: V.textMuted,
    textAlign: 'center',
  },
});
