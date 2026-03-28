import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import tw from 'twrnc';

const DOT_SIZE = 6;

const DOT_POSITIONS = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function DieFace({ value, isUsed, size = 48, animValue }) {
  const dots = DOT_POSITIONS[value] || [];
  const cellSize = size / 3;

  const spin = animValue
    ? animValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '720deg'],
      })
    : '0deg';

  const scale = animValue
    ? animValue.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 1.2, 1],
      })
    : 1;

  const Inner = (
    <View
      style={[
        tw`rounded-lg items-center justify-center`,
        {
          width: size,
          height: size,
          backgroundColor: isUsed ? '#4a4a4a' : '#FFFDE7',
          opacity: isUsed ? 0.4 : 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 4,
        },
      ]}
    >
      {dots.map(([row, col], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: DOT_SIZE / 2,
            backgroundColor: isUsed ? '#888' : '#212121',
            top: row * cellSize + (cellSize - DOT_SIZE) / 2,
            left: col * cellSize + (cellSize - DOT_SIZE) / 2,
          }}
        />
      ))}
    </View>
  );

  if (!animValue) return Inner;

  return (
    <Animated.View style={{ transform: [{ rotate: spin }, { scale }] }}>
      {Inner}
    </Animated.View>
  );
}

export default function Dice({
  dice,
  remainingMoves,
  canRoll,
  onRoll,
  rolling,
}) {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const justRolled = useRef(false);

  useEffect(() => {
    if (dice && dice.length === 2 && !rolling) {
      anim1.setValue(0);
      anim2.setValue(0);
      justRolled.current = true;
      Animated.stagger(80, [
        Animated.timing(anim1, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(anim2, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [dice]);

  useEffect(() => {
    if (canRoll) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      bounceAnim.setValue(1);
    }
  }, [canRoll]);

  const usedDice = () => {
    if (!dice || dice.length === 0) return [];
    const remaining = [...remainingMoves];
    return dice.map((d) => {
      const idx = remaining.indexOf(d);
      if (idx !== -1) {
        remaining.splice(idx, 1);
        return false;
      }
      return true;
    });
  };

  const used = usedDice();

  return (
    <View style={tw`items-center my-3`}>
      {canRoll ? (
        <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
          <TouchableOpacity
            onPress={onRoll}
            disabled={rolling}
            style={tw`bg-amber-600 rounded-xl px-8 py-3 ${rolling ? 'opacity-50' : ''}`}
          >
            <Text style={tw`text-white text-lg font-bold`}>
              {rolling ? '🎲 ...' : '🎲 Бросить кубики'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <View style={tw`flex-row gap-3`}>
          {dice.map((d, i) => (
            <DieFace
              key={i}
              value={d}
              isUsed={used[i]}
              animValue={i === 0 ? anim1 : anim2}
            />
          ))}
        </View>
      )}
    </View>
  );
}
