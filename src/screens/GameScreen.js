import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import tw from 'twrnc';
import { supabase } from '../lib/supabase';
import BackgammonBoard from '../components/BackgammonBoard';
import Dice from '../components/Dice';
import Chat from '../components/Chat';
import TurnTimer from '../components/TurnTimer';
import {
  createInitialGameState,
  rollDice,
  diceToMoves,
  getAllValidMoves,
  getHighlightedPoints,
  applyMove,
  shouldAutoEndTurn,
} from '../utils/gameLogic';

export default function GameScreen({ route, navigation }) {
  const { roomId, nickname, playerNumber: initialPlayerNumber } = route.params;

  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(createInitialGameState());
  const [playerNumber, setPlayerNumber] = useState(initialPlayerNumber);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [highlightedMoves, setHighlightedMoves] = useState([]);
  const [rolling, setRolling] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const channelRef = useRef(null);

  const isMyTurn = gameState.currentPlayer === playerNumber;

  // Load room and subscribe
  useEffect(() => {
    const loadRoom = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !data) {
        Alert.alert('Ошибка', 'Комната не найдена');
        navigation.goBack();
        return;
      }

      setRoom(data);
      if (data.game_state) setGameState(data.game_state);

      if (data.player1_name === nickname) setPlayerNumber(1);
      else if (data.player2_name === nickname) setPlayerNumber(2);
    };

    loadRoom();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new;
          setRoom(updated);
          if (updated.game_state) {
            setGameState(updated.game_state);
            setSelectedPoint(null);
            setHighlightedMoves([]);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId]);

  const syncGameState = useCallback(
    async (newState) => {
      const { error } = await supabase
        .from('rooms')
        .update({ game_state: newState })
        .eq('id', roomId);

      if (error) console.warn('Sync error:', error.message);
    },
    [roomId]
  );

  const handleTimeUp = useCallback(async () => {
    if (!isMyTurn) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const opponent = playerNumber === 1 ? 2 : 1;
    const newState = {
      ...gameState,
      currentPlayer: opponent,
      dice: [],
      remainingMoves: [],
      turnPhase: 'roll',
    };
    setGameState(newState);
    setSelectedPoint(null);
    setHighlightedMoves([]);
    await syncGameState(newState);
    Alert.alert('Время вышло', 'Ход переходит сопернику.');
  }, [isMyTurn, gameState, playerNumber, syncGameState]);

  const handleRollDice = useCallback(async () => {
    if (!isMyTurn || gameState.turnPhase !== 'roll') return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRolling(true);
    await new Promise((r) => setTimeout(r, 600));

    const dice = rollDice();
    const moves = diceToMoves(dice);
    const newState = {
      ...gameState,
      dice,
      remainingMoves: moves,
      turnPhase: 'move',
    };

    // Auto-end if no valid moves
    if (getAllValidMoves(newState).length === 0) {
      const opponent = playerNumber === 1 ? 2 : 1;
      const autoEndState = {
        ...newState,
        currentPlayer: opponent,
        dice: [],
        remainingMoves: [],
        turnPhase: 'roll',
      };
      setGameState(autoEndState);
      await syncGameState(autoEndState);
      setRolling(false);
      Alert.alert('Нет ходов', 'У тебя нет доступных ходов. Ход переходит сопернику.');
      return;
    }

    setGameState(newState);
    await syncGameState(newState);
    setRolling(false);
  }, [isMyTurn, gameState, playerNumber, syncGameState]);

  const handlePointPress = useCallback(
    (index) => {
      if (!isMyTurn || gameState.turnPhase !== 'move') return;

      // If we have a selected point, try to make a move
      if (selectedPoint !== null) {
        const matchingMove = highlightedMoves.find((m) => m.to === index);
        if (matchingMove) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const newState = applyMove(gameState, matchingMove);
          setGameState(newState);
          syncGameState(newState);
          setSelectedPoint(null);
          setHighlightedMoves([]);

          if (newState.gameOver) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Победа!', `Игрок ${newState.winner === playerNumber ? nickname : 'соперник'} победил!`);
          }
          return;
        }
      }

      // Select a point with own checker
      const val = gameState.board[index];
      const isOwn =
        (playerNumber === 1 && val > 0) || (playerNumber === 2 && val < 0);

      if (isOwn && gameState.bar[playerNumber] === 0) {
        setSelectedPoint(index);
        const moves = getHighlightedPoints(gameState, index);
        setHighlightedMoves(moves);
      } else {
        setSelectedPoint(null);
        setHighlightedMoves([]);
      }
    },
    [isMyTurn, gameState, selectedPoint, highlightedMoves, playerNumber, nickname, syncGameState]
  );

  const handleBarPress = useCallback(
    (barPlayer) => {
      if (!isMyTurn || gameState.turnPhase !== 'move') return;
      if (barPlayer !== playerNumber) return;
      if (gameState.bar[playerNumber] <= 0) return;

      setSelectedPoint('bar');
      const moves = getHighlightedPoints(gameState, 'bar');
      setHighlightedMoves(moves);
    },
    [isMyTurn, gameState, playerNumber]
  );

  const handleBearOffPress = useCallback(
    (bearOffPlayer) => {
      if (!isMyTurn || gameState.turnPhase !== 'move') return;
      if (selectedPoint === null) return;

      const matchingMove = highlightedMoves.find((m) => m.to === 'off');
      if (matchingMove) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newState = applyMove(gameState, matchingMove);
        setGameState(newState);
        syncGameState(newState);
        setSelectedPoint(null);
        setHighlightedMoves([]);

        if (newState.gameOver) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Победа!', `${newState.winner === playerNumber ? 'Ты' : 'Соперник'} победил!`);
        }
      }
    },
    [isMyTurn, gameState, selectedPoint, highlightedMoves, playerNumber, syncGameState]
  );

  const handleEndTurn = useCallback(async () => {
    const opponent = playerNumber === 1 ? 2 : 1;
    const newState = {
      ...gameState,
      currentPlayer: opponent,
      dice: [],
      remainingMoves: [],
      turnPhase: 'roll',
    };
    setGameState(newState);
    setSelectedPoint(null);
    setHighlightedMoves([]);
    await syncGameState(newState);
  }, [gameState, playerNumber, syncGameState]);

  const statusText = () => {
    if (!room) return 'Загрузка...';
    if (room.status === 'waiting') return 'Ожидание соперника...';
    if (gameState.gameOver) return `Победитель: ${gameState.winner === 1 ? room.player1_name : room.player2_name}`;
    if (gameState.currentPlayer === 0) return 'Игра начинается...';
    return isMyTurn ? 'Твой ход' : 'Ход соперника';
  };

  const canEndTurn =
    isMyTurn &&
    gameState.turnPhase === 'move' &&
    gameState.dice.length > 0 &&
    (gameState.remainingMoves.length === 0 || shouldAutoEndTurn(gameState));

  if (showChat) {
    return (
      <View style={tw`flex-1 bg-gray-900 pt-12`}>
        <View style={tw`flex-row justify-between items-center px-4 pb-2`}>
          <Text style={tw`text-white text-lg font-bold`}>Чат</Text>
          <TouchableOpacity onPress={() => setShowChat(false)}>
            <Text style={tw`text-amber-400 text-base font-semibold`}>← Доска</Text>
          </TouchableOpacity>
        </View>
        <Chat roomId={roomId} nickname={nickname} visible={true} />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-gray-900 pt-12`}>
      {/* Header */}
      <View style={tw`flex-row justify-between items-center px-4 mb-2`}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={tw`text-amber-400 text-base`}>← Назад</Text>
        </TouchableOpacity>
        <Text style={tw`text-gray-400 text-sm`}>
          #{room?.code || '...'}
        </Text>
        <TouchableOpacity onPress={() => setShowChat(true)}>
          <Text style={tw`text-amber-400 text-base`}>💬 Чат</Text>
        </TouchableOpacity>
      </View>

      {/* Players */}
      <View style={tw`flex-row justify-between px-4 mb-2`}>
        <View style={tw`flex-row items-center`}>
          <View style={tw`w-3 h-3 rounded-full bg-white mr-2`} />
          <Text
            style={tw`text-sm ${
              gameState.currentPlayer === 1 ? 'text-amber-400 font-bold' : 'text-gray-400'
            }`}
          >
            {room?.player1_name || '...'}
            {playerNumber === 1 ? ' (ты)' : ''}
          </Text>
        </View>
        <View style={tw`flex-row items-center`}>
          <Text
            style={tw`text-sm ${
              gameState.currentPlayer === 2 ? 'text-amber-400 font-bold' : 'text-gray-400'
            }`}
          >
            {room?.player2_name || 'Ожидание...'}
            {playerNumber === 2 ? ' (ты)' : ''}
          </Text>
          <View style={tw`w-3 h-3 rounded-full bg-gray-900 border border-gray-400 ml-2`} />
        </View>
      </View>

      {/* Status */}
      <View style={tw`items-center mb-1`}>
        <Text
          style={tw`text-base font-semibold ${
            isMyTurn ? 'text-amber-400' : 'text-gray-400'
          }`}
        >
          {statusText()}
        </Text>
      </View>

      {/* Turn Timer */}
      <TurnTimer
        isMyTurn={isMyTurn}
        isPlaying={room?.status === 'playing' && !gameState.gameOver}
        onTimeUp={handleTimeUp}
      />

      <ScrollView
        contentContainerStyle={tw`items-center pb-4`}
        showsVerticalScrollIndicator={false}
      >
        {/* Board */}
        <BackgammonBoard
          gameState={gameState}
          playerNumber={playerNumber}
          selectedPoint={selectedPoint}
          highlightedMoves={highlightedMoves}
          onPointPress={handlePointPress}
          onBarPress={handleBarPress}
          onBearOffPress={handleBearOffPress}
        />

        {/* Dice */}
        <Dice
          dice={gameState.dice}
          remainingMoves={gameState.remainingMoves}
          canRoll={isMyTurn && gameState.turnPhase === 'roll' && room?.status === 'playing'}
          onRoll={handleRollDice}
          rolling={rolling}
        />

        {/* End turn button */}
        {canEndTurn && (
          <TouchableOpacity
            style={tw`bg-red-700 rounded-xl px-6 py-2.5 mt-1`}
            onPress={handleEndTurn}
          >
            <Text style={tw`text-white font-semibold`}>Завершить ход</Text>
          </TouchableOpacity>
        )}

        {/* Score */}
        <View style={tw`flex-row justify-center gap-6 mt-3`}>
          <View style={tw`items-center`}>
            <Text style={tw`text-gray-500 text-xs`}>Снято P1</Text>
            <Text style={tw`text-white text-lg font-bold`}>{gameState.borneOff[1]}/15</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-gray-500 text-xs`}>Бар P1</Text>
            <Text style={tw`text-white text-lg font-bold`}>{gameState.bar[1]}</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-gray-500 text-xs`}>Бар P2</Text>
            <Text style={tw`text-white text-lg font-bold`}>{gameState.bar[2]}</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-gray-500 text-xs`}>Снято P2</Text>
            <Text style={tw`text-white text-lg font-bold`}>{gameState.borneOff[2]}/15</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
