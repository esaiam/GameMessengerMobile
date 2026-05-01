import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import tw from 'twrnc';
import { Dices } from '../icons/lucideIcons';
import { V } from '../theme';
import { supabase } from '../lib/supabase';
import { useAuthGate, NICKNAME_STORAGE_KEY } from '../context/AuthGateContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HANDLE_MAX = 32;
const HANDLE_RE = /^[a-z0-9_]+$/;

function sanitizeSlug(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export default function PickHandleScreen() {
  const { session, refreshProfile } = useAuthGate();
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);

  const onChangeSlug = (t) => {
    const s = sanitizeSlug(t).slice(0, HANDLE_MAX);
    setSlug(s);
  };

  const save = async () => {
    if (!session?.user?.id) {
      Alert.alert('Ошибка', 'Нет сессии. Войдите снова.');
      return;
    }
    if (slug.length < 1) {
      Alert.alert('Внимание', 'Введите handle (латиница, цифры, _).');
      return;
    }
    if (!HANDLE_RE.test(slug)) {
      Alert.alert('Внимание', 'Только a–z, 0–9 и подчёркивание.');
      return;
    }

    setBusy(true);
    try {
      const { data: taken, error: selErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('handle', slug)
        .maybeSingle();
      if (selErr) throw selErr;
      if (taken) {
        Alert.alert('Занято', 'Этот @handle уже выбран. Придумай другой.');
        return;
      }

      const { error: insErr } = await supabase.from('profiles').insert({
        id: session.user.id,
        handle: slug,
      });
      if (insErr) {
        if (insErr.code === '23505') {
          if (String(insErr.details || '').includes('(id)')) {
            await refreshProfile();
            return;
          }
          Alert.alert('Занято', 'Этот @handle уже занят.');
          return;
        }
        throw insErr;
      }

      await AsyncStorage.setItem(NICKNAME_STORAGE_KEY, slug);
      await refreshProfile();
    } catch (e) {
      const msg = e?.message || 'Не удалось сохранить';
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
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]}>Ваш @handle</Text>
        </View>
        <Text style={[tw`text-[13px] mb-8 text-center`, { color: V.textSecondary, lineHeight: 20 }]}>
          Он будет виден друзьям. Только латиница в нижнем регистре, цифры и _, до {HANDLE_MAX}{' '}
          символов.
        </Text>

        <View style={tw`w-full mb-6`}>
          <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
            Handle
          </Text>
          <View
            style={[
              tw`w-full flex-row items-center rounded-[10px] px-3`,
              {
                backgroundColor: V.bgSurface,
                borderWidth: 0.5,
                borderColor: V.border,
              },
            ]}
          >
            <Text style={[tw`text-[13px] font-medium`, { color: V.textMuted }]}>@</Text>
            <TextInput
              style={[
                tw`flex-1 py-3.5 px-1 text-[16px]`,
                { color: V.textPrimary },
              ]}
              placeholder="username"
              placeholderTextColor={V.textGhost}
              value={slug}
              onChangeText={onChangeSlug}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={HANDLE_MAX}
              editable={!busy}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            tw`w-full rounded-[10px] py-3.5 items-center flex-row justify-center`,
            {
              backgroundColor: V.btnPrimaryBg,
              borderWidth: 0.5,
              borderColor: V.accentSage,
              opacity: busy || !slug ? 0.5 : 1,
            },
          ]}
          onPress={save}
          disabled={busy || !slug}
        >
          {busy ? (
            <ActivityIndicator color={V.accentSage} />
          ) : (
            <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>Продолжить</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
