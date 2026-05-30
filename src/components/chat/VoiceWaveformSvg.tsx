import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { V } from '../../theme';

export function WaveformSvg({
  bars,
  w,
  h = 28,
  fill = V.accentSage,
}: {
  bars: number[];
  w: number;
  h?: number;
  fill?: string;
}) {
  if (w <= 0) return null;
  const bw = w / bars.length;
  return (
    <Svg width={w} height={h}>
      {bars.map((amp, i) => {
        const bh = Math.max(2, amp * h * 0.85);
        return (
          <Rect
            key={i}
            x={i * bw + 0.5}
            y={(h - bh) / 2}
            width={Math.max(1.5, bw - 1)}
            height={bh}
            rx={1}
            fill={fill}
          />
        );
      })}
    </Svg>
  );
}
