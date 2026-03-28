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

const NICKNAME_KEY = '@backgammon_nickname';

export default function LoginScreen({ navigation }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(NICKNAME_KEY).then((stored) => {
      if (stored) {
        navigation.replace('Home', { nickname: stored });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleLogin = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(NICKNAME_KEY, trimmed);
    navigation.replace('Home', { nickname: trimmed });
  };

  if (loading) {
    return (
      <View style={tw`flex-1 bg-gray-900 items-center justify-center`}>
        <Text style={tw`text-white text-lg`}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1 bg-gray-900`}
    >
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <Text style={tw`text-white text-4xl font-bold mb-2`}>🎲 Нарды</Text>
        <Text style={tw`text-gray-400 text-base mb-10`}>
          Играй с друзьями онлайн
        </Text>

        <View style={tw`w-full mb-6`}>
          <Text style={tw`text-gray-300 text-sm mb-2 ml-1`}>Твой никнейм</Text>
          <TextInput
            style={tw`w-full bg-gray-800 text-white rounded-xl px-4 py-3.5 text-base border border-gray-700`}
            placeholder="Введи ник..."
            placeholderTextColor="#6b7280"
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={tw`w-full bg-amber-600 rounded-xl py-3.5 items-center ${
            !nickname.trim() ? 'opacity-50' : ''
          }`}
          onPress={handleLogin}
          disabled={!nickname.trim()}
        >
          <Text style={tw`text-white text-lg font-semibold`}>Войти</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
