import React, { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ColorValue } from 'react-native';

type Props = {
  colors: readonly string[] | string[];
  /** Длина должна совпадать с `colors`, значения 0…1 */
  positions?: readonly number[];
};

function defaultPositions(n: number): number[] {
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i / (n - 1));
  return out;
}

/**
 * Вертикальный градиент под контент пузыря (`expo-linear-gradient`).
 * Родитель с `overflow: 'hidden'` и `borderRadius` задаёт форму.
 */
function BubbleLinearGradient({ colors, positions }: Props) {
  const list = useMemo(() => [...colors], [colors]);
  const loc = useMemo(() => {
    if (positions && positions.length === list.length) {
      return [...positions] as number[];
    }
    return defaultPositions(list.length);
  }, [positions, list.length]);

  if (list.length < 2) {
    return null;
  }

  const colorsTuple = list as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]];
  const locationsTuple =
    loc.length >= 2 && loc.length === list.length
      ? (loc as unknown as readonly [number, number, ...number[]])
      : undefined;

  return (
    <LinearGradient
      pointerEvents="none"
      colors={colorsTuple}
      locations={locationsTuple}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

export default React.memo(BubbleLinearGradient);
