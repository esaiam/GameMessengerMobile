import React, { useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

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
 * Вертикальный градиент под контент пузыря.
 * Родитель с `overflow: 'hidden'` и `borderRadius` задаёт форму — здесь прямоугольная заливка.
 *
 * Раньше использовался `Canvas` из `@shopify/react-native-skia`; в связке Reanimated 3+
 * первый кадр идёт через worklet и `Skia.Picture.MakePicture(null)` падает с
 * «Expected arraybuffer as first parameter». Для пузыря достаточно `expo-linear-gradient`
 * (один нативный слой, без Skia reconciliation).
 */
function BubbleSkiaGradient({ colors, positions }: Props) {
  const list = useMemo(() => [...colors], [colors]);
  const loc = useMemo(() => {
    if (positions && positions.length === list.length) {
      return [...positions] as number[];
    }
    return defaultPositions(list.length);
  }, [positions, list.length]);

  return (
    <LinearGradient
      pointerEvents="none"
      colors={list}
      locations={loc}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

export default React.memo(BubbleSkiaGradient);
