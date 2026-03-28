import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import tw from 'twrnc';
import { supabase } from '../lib/supabase';

export default function HistoryScreen({ route, navigation }) {
  const { nickname } = route.params;
  const [games, setGames] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'finished')
      .or(`player1_name.eq.${nickname},player2_name.eq.${nickname}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setGames(data);
  }, [nickname]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const getResult = (game) => {
    const gs = game.game_state;
    if (!gs || !gs.winner) return { text: 'Не завершена', color: 'text-gray-400' };
    const winnerName = gs.winner === 1 ? game.player1_name : game.player2_name;
    const iWon = winnerName === nickname;
    return {
      text: iWon ? 'Победа' : 'Поражение',
      color: iWon ? 'text-green-400' : 'text-red-400',
    };
  };

  const getStats = () => {
    let wins = 0;
    let losses = 0;
    games.forEach((g) => {
      const gs = g.game_state;
      if (!gs?.winner) return;
      const winnerName = gs.winner === 1 ? g.player1_name : g.player2_name;
      if (winnerName === nickname) wins++;
      else losses++;
    });
    return { wins, losses, total: games.length };
  };

  const stats = getStats();

  const renderGame = ({ item }) => {
    const result = getResult(item);
    const opponent =
      item.player1_name === nickname ? item.player2_name : item.player1_name;
    const date = new Date(item.created_at).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={tw`bg-gray-800 rounded-xl p-4 mb-3 border border-gray-700`}>
        <View style={tw`flex-row justify-between items-center mb-1`}>
          <Text style={tw`text-gray-400 text-xs`}>#{item.code}</Text>
          <Text style={tw`text-gray-500 text-xs`}>{date}</Text>
        </View>
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={tw`text-white text-sm`}>
            vs {opponent || 'Неизвестный'}
          </Text>
          <Text style={tw`${result.color} font-bold text-sm`}>
            {result.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={tw`flex-1 bg-gray-900 pt-12 px-4`}>
      <View style={tw`flex-row items-center justify-between mb-4`}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={tw`text-amber-400 text-base`}>← Назад</Text>
        </TouchableOpacity>
        <Text style={tw`text-white text-xl font-bold`}>История</Text>
        <View style={tw`w-16`} />
      </View>

      {/* Stats */}
      <View style={tw`flex-row justify-around bg-gray-800 rounded-xl p-4 mb-5`}>
        <View style={tw`items-center`}>
          <Text style={tw`text-2xl font-bold text-white`}>{stats.total}</Text>
          <Text style={tw`text-gray-400 text-xs mt-1`}>Всего игр</Text>
        </View>
        <View style={tw`items-center`}>
          <Text style={tw`text-2xl font-bold text-green-400`}>{stats.wins}</Text>
          <Text style={tw`text-gray-400 text-xs mt-1`}>Побед</Text>
        </View>
        <View style={tw`items-center`}>
          <Text style={tw`text-2xl font-bold text-red-400`}>{stats.losses}</Text>
          <Text style={tw`text-gray-400 text-xs mt-1`}>Поражений</Text>
        </View>
        <View style={tw`items-center`}>
          <Text style={tw`text-2xl font-bold text-amber-400`}>
            {stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}%
          </Text>
          <Text style={tw`text-gray-400 text-xs mt-1`}>Винрейт</Text>
        </View>
      </View>

      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d97706"
          />
        }
        ListEmptyComponent={
          <Text style={tw`text-gray-500 text-center py-8`}>
            Ещё нет завершённых игр
          </Text>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
