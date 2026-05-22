import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert } from 'react-native';
import tw from 'twrnc';
import { V } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuthGate } from '../context/AuthGateContext';

export default function RecoverPasswordScreen() {
  const { clearPasswordRecoveryFlow } = useAuthGate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Внимание', 'Пароль не короче 6 символов.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Готово', 'Пароль обновлён. Можно пользоваться приложением.', [
        { text: 'Ок', onPress: () => clearPasswordRecoveryFlow() }]);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сменить пароль');
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      clearPasswordRecoveryFlow();
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[tw`flex-1`, { backgroundColor: V.bgApp }]}
    >
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <Text style={[tw`text-[15px] font-medium text-center mb-2`, { color: V.textPrimary }]}>
          Новый пароль
        </Text>
        <Text style={[tw`text-[12px] text-center mb-8`, { color: V.textSecondary, lineHeight: 18 }]}>
          Задайте новый пароль для входа в аккаунт
        </Text>

        <View style={tw`w-full mb-4`}>
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

        <View style={tw`w-full mb-6`}>
          <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
            Подтверждение
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

        <TouchableOpacity
          style={[
            tw`w-full rounded-[10px] py-3.5 items-center flex-row justify-center mb-3`,
            {
              backgroundColor: V.btnPrimaryBg,
              borderWidth: 0.5,
              borderColor: V.accentSage,
              opacity: busy ? 0.6 : 1 }]}
          onPress={onSave}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={V.accentSage} />
          ) : (
            <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>Сохранить пароль</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onCancel} disabled={busy} style={tw`py-2`}>
          <Text style={[tw`text-[13px] text-center`, { color: V.textMuted }]}>Отмена</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
