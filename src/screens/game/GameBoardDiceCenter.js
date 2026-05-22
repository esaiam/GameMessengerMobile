import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { DieFace } from '../../components/Dice';
import { V } from '../../theme';

export default function GameBoardDiceCenter({
  boardMode,
  gameStarted,
  gameState,
  sandboxUiDice,
  uiDice,
}) {
  const showSandbox = boardMode === 'sandbox' && Array.isArray(sandboxUiDice) && sandboxUiDice.length === 2;
  const showMatch =
    boardMode === 'match' &&
    (gameStarted
      ? gameState.turnPhase === 'preroll' ||
        (Array.isArray(gameState.dice) && gameState.dice.length === 2)
      : Array.isArray(uiDice) && uiDice.length === 2);

  if (!showSandbox && !showMatch) return null;

  return (
    <View style={tw`flex-1 items-center justify-center`}>
      {boardMode === 'sandbox' && (
        <View
          style={[
            tw`mb-2 px-3 py-1 rounded-[10px]`,
            { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
          ]}
        >
          <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Песочница</Text>
        </View>
      )}
      <View style={tw`items-center justify-center`}>
        {boardMode === 'match' && gameState.turnPhase === 'preroll' ? (
          <View style={tw`gap-2`}>
            <View style={tw`flex-row items-center justify-center gap-3`}>
              <DieFace value={gameState.preStartRolls?.[1]?.[0] ?? 1} isUsed={false} size={36} />
              <DieFace value={gameState.preStartRolls?.[1]?.[1] ?? 1} isUsed={false} size={36} />
            </View>
            <View style={tw`flex-row items-center justify-center gap-3`}>
              <DieFace value={gameState.preStartRolls?.[2]?.[0] ?? 1} isUsed={false} size={36} />
              <DieFace value={gameState.preStartRolls?.[2]?.[1] ?? 1} isUsed={false} size={36} />
            </View>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 10 }}>
              <DieFace
                value={
                  boardMode === 'sandbox'
                    ? sandboxUiDice[0]
                    : gameStarted
                      ? gameState.dice?.[0]
                      : uiDice?.[0]
                }
                isUsed={false}
                size={42}
              />
            </View>
            <DieFace
              value={
                boardMode === 'sandbox'
                  ? sandboxUiDice[1]
                  : gameStarted
                    ? gameState.dice?.[1]
                    : uiDice?.[1]
              }
              isUsed={false}
              size={42}
            />
          </>
        )}
      </View>
    </View>
  );
}
