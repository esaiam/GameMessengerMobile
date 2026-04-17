import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import tw from 'twrnc';
import { V } from '../theme';

const TURN_DURATION = 60;

export default function TurnTimer({ isMyTurn, isPlaying, onTimeUp }) {
  const [seconds, setSeconds] = useState(TURN_DURATION);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const widthAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setSeconds(TURN_DURATION);
    widthAnim.setValue(1);
  }, [isMyTurn]);

  useEffect(() => {
    if (!isPlaying || !isMyTurn) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    Animated.timing(widthAnim, {
      toValue: 0,
      duration: TURN_DURATION * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    return () => clearInterval(interval);
  }, [isMyTurn, isPlaying]);

  useEffect(() => {
    if (seconds <= 10 && seconds > 0 && isMyTurn) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [seconds]);

  if (!isPlaying) return null;

  const barColor = seconds > 20 ? V.accentSage : seconds > 10 ? V.accentGold : V.dangerMuted;

  return (
    <View style={tw`px-4 mb-2`}>
      <View style={tw`flex-row items-center justify-between mb-1`}>
        <Text style={[tw`text-[10px]`, { color: V.textMuted }]}>
          {isMyTurn ? 'Твоё время' : 'Время соперника'}
        </Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={[tw`text-[13px] font-medium`, { color: barColor }]}>
            {seconds}с
          </Text>
        </Animated.View>
      </View>
      <View style={[tw`h-1.5 rounded-full overflow-hidden`, { backgroundColor: V.bgSurface }]}>
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: barColor,
            borderRadius: 999,
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>
    </View>
  );
}
