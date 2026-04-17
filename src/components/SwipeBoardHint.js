import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, View, StyleSheet } from 'react-native';
import { Hand } from 'lucide-react-native/icons';

const W = Dimensions.get('window').width;

/**
 * Подсказка для новых пользователей: анимация ладони, проводящей свайп по доске.
 * pointerEvents="none" — не перехватывает жесты.
 */
export default function SwipeBoardHint({ visible, boardWidth = W, boardHeight, onComplete }) {
  const tx = useRef(new Animated.Value(boardWidth * 0.1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const masterRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (masterRef.current) {
      masterRef.current.stop?.();
      masterRef.current = null;
    }
    if (!visible || !boardHeight) {
      tx.setValue(boardWidth * 0.1);
      opacity.setValue(0);
      return;
    }

    const startX = boardWidth * 0.08;
    const endX = boardWidth * 0.72;
    const dur = 1100;

    const oneCycle = () =>
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.92,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(tx, {
            toValue: startX,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(tx, {
          toValue: endX,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(350),
      ]);

    const master = Animated.sequence([oneCycle(), oneCycle(), oneCycle()]);
    masterRef.current = master;
    master.start(({ finished }) => {
      if (finished) onCompleteRef.current?.();
    });

    return () => {
      master.stop?.();
    };
  }, [visible, boardWidth, boardHeight, tx, opacity]);

  if (!visible || !boardHeight) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { width: boardWidth, height: boardHeight },
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: boardHeight * 0.42,
          transform: [{ translateX: tx }, { rotate: '-18deg' }],
          opacity,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 3,
          elevation: 4,
        }}
      >
        <Hand size={52} color="#FFFEF5" strokeWidth={1.8} />
      </Animated.View>
    </View>
  );
}
