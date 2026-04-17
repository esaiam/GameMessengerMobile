import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from 'twrnc';
import { Dices } from '../icons/lucideIcons';
import { V } from '../theme';

const NICKNAME_KEY = '@backgammon_nickname';

export default function LoginScreen({ navigation }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(NICKNAME_KEY).then((stored) => {
      if (stored) {
        navigation.replace('Main', { nickname: stored });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleLogin = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(NICKNAME_KEY, trimmed);
    navigation.replace('Main', { nickname: trimmed });
  };

  if (loading) {
    return (
      <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: V.bgApp }]}>
        <Text style={[tw`text-[13px]`, { color: V.textPrimary }]}>Загрузка...</Text>
      </View>
    );
  }

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
        <Text style={[tw`text-[13px] mb-10`, { color: V.textSecondary, lineHeight: 20 }]}>
          Играй с друзьями онлайн
        </Text>

        <View style={tw`w-full mb-6`}>
          <Text style={[tw`text-[13px] font-medium mb-2 ml-1`, { color: V.textSecondary }]}>
            Твой никнейм
          </Text>
          <TextInput
            style={[
              tw`w-full px-4 py-3.5 text-[13px] rounded-[10px]`,
              {
                backgroundColor: V.bgSurface,
                color: V.textPrimary,
                borderWidth: 0.5,
                borderColor: V.border,
              },
            ]}
            placeholder="Введи ник..."
            placeholderTextColor={V.textGhost}
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[
            tw`w-full rounded-[10px] py-3.5 items-center ${!nickname.trim() ? 'opacity-50' : ''}`,
            {
              backgroundColor: V.btnPrimaryBg,
              borderWidth: 0.5,
              borderColor: V.accentSage,
            },
          ]}
          onPress={handleLogin}
          disabled={!nickname.trim()}
        >
          <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>Войти</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
