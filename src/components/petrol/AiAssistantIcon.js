import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { V } from '../../theme';

/** Twin-sparkle AI icon from Open Design vault.html */
export default function AiAssistantIcon({
  size = 22,
  color = V.textMuted,
  strokeWidth = 1.6,
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
