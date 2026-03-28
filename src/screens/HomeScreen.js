import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from 'twrnc';
import { supabase } from '../lib/supabase';
import { createInitialGameState } from '../utils/gameLogic';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function HomeScreen({ route, navigation }) {
  const { nickname } = route.params;
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(30);
    if (!error && data) setRooms(data);
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const createRoom = async () => {
    setCreating(true);
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        player1_name: nickname,
        status: 'waiting',
        game_state: createInitialGameState(),
      })
      .select()
      .single();

    setCreating(false);
    if (error) {
      Alert.alert('Ошибка', error.message);
      return;
    }
    navigation.navigate('Game', {
      roomId: data.id,
      nickname,
      playerNumber: 1,
    });
  };

  const joinRoom = async (room) => {
    if (room.player1_name === nickname) {
      navigation.navigate('Game', {
        roomId: room.id,
        nickname,
        playerNumber: 1,
      });
      return;
    }

    if (room.player2_name && room.player2_name !== nickname) {
      Alert.alert('Ошибка', 'Комната уже заполнена');
      return;
    }

    if (!room.player2_name) {
      const gameState = room.game_state || createInitialGameState();
      gameState.currentPlayer = 1;
      gameState.turnPhase = 'roll';

      const { error } = await supabase
        .from('rooms')
        .update({
          player2_name: nickname,
          status: 'playing',
          game_state: gameState,
        })
        .eq('id', room.id);

      if (error) {
        Alert.alert('Ошибка', error.message);
        return;
      }
    }

    navigation.navigate('Game', {
      roomId: room.id,
      nickname,
      playerNumber: room.player2_name === nickname ? 2 : 2,
    });
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      Alert.alert('Ошибка', 'Комната не найдена');
      return;
    }
    setJoinCode('');
    joinRoom(data);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@backgammon_nickname');
    navigation.replace('Login');
  };

  const renderRoom = ({ item }) => {
    const isMine = item.player1_name === nickname || item.player2_name === nickname;
    const isFull = !!item.player2_name;

    return (
      <TouchableOpacity
        style={tw`bg-gray-800 rounded-xl p-4 mb-3 border ${
          isMine ? 'border-amber-600' : 'border-gray-700'
        }`}
        onPress={() => joinRoom(item)}
      >
        <View style={tw`flex-row justify-between items-center mb-2`}>
          <Text style={tw`text-amber-400 font-bold text-base`}>
            #{item.code}
          </Text>
          <View
            style={tw`px-2 py-0.5 rounded-full ${
              item.status === 'waiting' ? 'bg-green-900' : 'bg-blue-900'
            }`}
          >
            <Text
              style={tw`text-xs ${
                item.status === 'waiting' ? 'text-green-400' : 'text-blue-400'
              }`}
            >
              {item.status === 'waiting' ? 'Ожидание' : 'Игра'}
            </Text>
          </View>
        </View>
        <Text style={tw`text-gray-300 text-sm`}>
          👤 {item.player1_name}
          {item.player2_name ? ` vs ${item.player2_name}` : ' — ждёт соперника'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={tw`flex-1 bg-gray-900 pt-12 px-4`}>
      {/* Header */}
      <View style={tw`flex-row justify-between items-center mb-6`}>
        <View>
          <Text style={tw`text-white text-2xl font-bold`}>🎲 Нарды</Text>
          <Text style={tw`text-gray-400 text-sm`}>Привет, {nickname}!</Text>
        </View>
        <TouchableOpacity
          style={tw`bg-gray-800 px-3 py-2 rounded-lg`}
          onPress={handleLogout}
        >
          <Text style={tw`text-gray-400 text-sm`}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* Join by code */}
      <View style={tw`flex-row mb-4`}>
        <TextInput
          style={tw`flex-1 bg-gray-800 text-white rounded-l-xl px-4 py-3 text-base border border-gray-700 border-r-0`}
          placeholder="Код комнаты..."
          placeholderTextColor="#6b7280"
          value={joinCode}
          onChangeText={setJoinCode}
          autoCapitalize="characters"
          maxLength={6}
        />
        <TouchableOpacity
          style={tw`bg-amber-600 rounded-r-xl px-5 justify-center`}
          onPress={joinByCode}
        >
          <Text style={tw`text-white font-semibold`}>Войти</Text>
        </TouchableOpacity>
      </View>

      {/* Create room */}
      <TouchableOpacity
        style={tw`bg-amber-600 rounded-xl py-3.5 items-center mb-5 ${
          creating ? 'opacity-50' : ''
        }`}
        onPress={createRoom}
        disabled={creating}
      >
        <Text style={tw`text-white text-base font-semibold`}>
          + Создать комнату
        </Text>
      </TouchableOpacity>

      {/* History button */}
      <TouchableOpacity
        style={tw`bg-gray-800 rounded-xl py-3 items-center mb-5 border border-gray-700`}
        onPress={() => navigation.navigate('History', { nickname })}
      >
        <Text style={tw`text-gray-300 text-base font-semibold`}>
          📊 История матчей
        </Text>
      </TouchableOpacity>

      {/* Room list */}
      <Text style={tw`text-gray-400 text-sm mb-3 ml-1`}>Доступные комнаты</Text>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d97706"
          />
        }
        ListEmptyComponent={
          <Text style={tw`text-gray-500 text-center py-8`}>
            Пока нет комнат. Создай первую!
          </Text>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
