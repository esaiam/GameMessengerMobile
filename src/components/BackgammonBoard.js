import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import tw from 'twrnc';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_WIDTH = SCREEN_WIDTH - 16;
const POINT_WIDTH = (BOARD_WIDTH - 40) / 12; // 12 points per half, minus bar & edges
const BAR_WIDTH = 30;
const EDGE_WIDTH = 5;
const CHECKER_SIZE = Math.min(POINT_WIDTH - 4, 28);
const POINT_HEIGHT = 130;

const COLORS = {
  boardBg: '#5D4037',
  darkTriangle: '#2E1B0E',
  lightTriangle: '#D4A574',
  player1: '#F5F5F5',
  player1Border: '#BDBDBD',
  player2: '#212121',
  player2Border: '#616161',
  highlight: '#FFD54F',
  selected: '#FF8F00',
  barBg: '#4E342E',
};

function Checker({ player, size = CHECKER_SIZE, isSelected }) {
  const bg = player === 1 ? COLORS.player1 : COLORS.player2;
  const border = player === 1 ? COLORS.player1Border : COLORS.player2Border;
  return (
    <View
      style={[
        tw`rounded-full items-center justify-center`,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderWidth: 2,
          borderColor: isSelected ? COLORS.selected : border,
        },
        isSelected && { shadowColor: COLORS.selected, shadowRadius: 6, shadowOpacity: 0.8, elevation: 5 },
      ]}
    >
      {isSelected && (
        <View
          style={{
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: COLORS.selected,
          }}
        />
      )}
    </View>
  );
}

function Triangle({ index, isTop, color, checkers, player, isHighlighted, isSelected, onPress, maxDisplay = 5 }) {
  const count = Math.abs(checkers);
  const displayCount = Math.min(count, maxDisplay);
  const extra = count > maxDisplay ? count - maxDisplay : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          width: POINT_WIDTH,
          height: POINT_HEIGHT,
          alignItems: 'center',
          justifyContent: isTop ? 'flex-start' : 'flex-end',
        },
        isHighlighted && { backgroundColor: 'rgba(255, 213, 79, 0.25)', borderRadius: 4 },
      ]}
    >
      {/* Triangle shape */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: POINT_WIDTH / 2 - 1,
          borderRightWidth: POINT_WIDTH / 2 - 1,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          ...(isTop
            ? { borderTopWidth: POINT_HEIGHT * 0.8, borderTopColor: color }
            : { borderBottomWidth: POINT_HEIGHT * 0.8, borderBottomColor: color }),
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
        }}
      />

      {/* Checkers */}
      <View
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 2,
          alignItems: 'center',
        }}
      >
        {Array.from({ length: displayCount }).map((_, i) => (
          <View key={i} style={{ marginBottom: isTop ? -4 : 0, marginTop: !isTop ? -4 : 0 }}>
            <Checker
              player={player}
              size={CHECKER_SIZE}
              isSelected={isSelected && i === displayCount - 1}
            />
          </View>
        ))}
        {extra > 0 && (
          <Text style={tw`text-white text-xs font-bold mt-0.5`}>+{extra}</Text>
        )}
      </View>

      {/* Point number */}
      <Text
        style={[
          tw`text-gray-500 text-[9px] absolute`,
          isTop ? { bottom: -12 } : { top: -12 },
        ]}
      >
        {index + 1}
      </Text>
    </TouchableOpacity>
  );
}

function BarSection({ bar, playerNumber, onPress, isSelected }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          width: BAR_WIDTH,
          height: POINT_HEIGHT,
          backgroundColor: COLORS.barBg,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        },
      ]}
    >
      {bar > 0 && (
        <View style={tw`items-center`}>
          <Checker player={playerNumber} size={CHECKER_SIZE - 2} isSelected={isSelected} />
          {bar > 1 && (
            <Text style={tw`text-white text-xs font-bold mt-1`}>{bar}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function BearOffSection({ count, player, onPress, isHighlighted }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          width: 30,
          minHeight: 60,
          backgroundColor: isHighlighted ? 'rgba(255, 213, 79, 0.4)' : 'rgba(255,255,255,0.05)',
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        },
      ]}
    >
      {count > 0 && (
        <>
          <Checker player={player} size={20} />
          <Text style={tw`text-white text-xs font-bold mt-1`}>{count}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function BackgammonBoard({
  gameState,
  playerNumber,
  selectedPoint,
  highlightedMoves,
  onPointPress,
  onBarPress,
  onBearOffPress,
}) {
  const { board, bar, borneOff } = gameState;

  const highlightedTargets = (highlightedMoves || []).map((m) => m.to);

  // Top row: points 13–24 (indices 12–23), left to right
  // But from player 2's perspective we might flip. Keep standard for now.
  const topIndices = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const bottomIndices = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  const renderHalf = (indices, isTop) => {
    const leftHalf = indices.slice(0, 6);
    const rightHalf = indices.slice(6, 12);

    return (
      <View style={tw`flex-row items-${isTop ? 'start' : 'end'}`}>
        {/* Left 6 points */}
        {leftHalf.map((idx) => {
          const val = board[idx];
          const player = val > 0 ? 1 : val < 0 ? 2 : 0;
          const color = idx % 2 === 0 ? COLORS.darkTriangle : COLORS.lightTriangle;
          return (
            <Triangle
              key={idx}
              index={idx}
              isTop={isTop}
              color={color}
              checkers={val}
              player={player}
              isHighlighted={highlightedTargets.includes(idx)}
              isSelected={selectedPoint === idx}
              onPress={() => onPointPress(idx)}
            />
          );
        })}

        {/* Bar */}
        <BarSection
          bar={isTop ? bar[2] : bar[1]}
          playerNumber={isTop ? 2 : 1}
          onPress={() => onBarPress(isTop ? 2 : 1)}
          isSelected={selectedPoint === 'bar'}
        />

        {/* Right 6 points */}
        {rightHalf.map((idx) => {
          const val = board[idx];
          const player = val > 0 ? 1 : val < 0 ? 2 : 0;
          const color = idx % 2 === 0 ? COLORS.darkTriangle : COLORS.lightTriangle;
          return (
            <Triangle
              key={idx}
              index={idx}
              isTop={isTop}
              color={color}
              checkers={val}
              player={player}
              isHighlighted={highlightedTargets.includes(idx)}
              isSelected={selectedPoint === idx}
              onPress={() => onPointPress(idx)}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View
      style={[
        tw`rounded-xl overflow-hidden`,
        {
          backgroundColor: COLORS.boardBg,
          padding: 6,
          width: BOARD_WIDTH,
          alignSelf: 'center',
        },
      ]}
    >
      {/* Bear off zones */}
      <View style={tw`flex-row justify-between items-center`}>
        <BearOffSection
          count={borneOff[2]}
          player={2}
          onPress={() => onBearOffPress(2)}
          isHighlighted={false}
        />

        <View style={tw`flex-1 mx-1`}>
          {/* Top half */}
          {renderHalf(topIndices, true)}

          {/* Center separator */}
          <View style={[tw`my-2`, { height: 20, backgroundColor: COLORS.barBg, borderRadius: 4 }]} />

          {/* Bottom half */}
          {renderHalf(bottomIndices, false)}
        </View>

        <BearOffSection
          count={borneOff[1]}
          player={1}
          onPress={() => onBearOffPress(1)}
          isHighlighted={highlightedTargets.includes('off')}
        />
      </View>
    </View>
  );
}
