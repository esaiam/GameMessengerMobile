import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from 'twrnc';
import { V } from '../theme';

const NICKNAME_KEY = '@backgammon_nickname';

export default function HomeScreen({ route, navigation }) {
  const [nickname, setNickname] = useState(route.params?.nickname || '');

  useEffect(() => {
    if (route.params?.nickname && route.params.nickname !== nickname) {
      setNickname(route.params.nickname);
      return;
    }
    if (!route.params?.nickname && !nickname) {
      AsyncStorage.getItem(NICKNAME_KEY).then((stored) => {
        if (stored) setNickname(stored);
      });
    }
  }, [route.params?.nickname, nickname]);

  return (
    <View style={[tw`flex-1 pt-12 px-4`, { backgroundColor: V.bgApp }]}>
      {/* Header */}
      <View style={tw`flex-row justify-between items-center mb-6`}>
        <View>
          <Text style={[tw`text-[17px] font-medium`, { color: V.textPrimary }]}>Игры</Text>
          <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Привет, {nickname}!</Text>
        </View>
      </View>

      <Text style={[tw`text-[12px]`, { color: V.textSecondary, lineHeight: 18 }]}>
        Игры теперь живут внутри чатов: комната = чат, а новые партии создаются кнопкой New game в комнате.
      </Text>
    </View>
  );
}
