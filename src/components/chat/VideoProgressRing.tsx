import React, { useMemo } from 'react';
import { View, StyleSheet, type GestureResponderHandlers } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { V } from '../../theme';
import {
  RING_C,
  RING_STROKE,
  RING_R,
  KNOB_R,
  KNOB_ORBIT_R,
  RING_CIRC,
  RING_TRACK,
} from './videoMessageConstants';

interface VideoProgressRingProps {
  progress01: number;
  panHandlers: GestureResponderHandlers;
}

export default function VideoProgressRing({ progress01, panHandlers }: VideoProgressRingProps) {
  const progressClamped = Math.min(1, Math.max(0, progress01));

  const knobStyle = useMemo(() => {
    const knobAngle = progressClamped * 2 * Math.PI - Math.PI / 2;
    const knobX = RING_C + KNOB_ORBIT_R * Math.cos(knobAngle);
    const knobY = RING_C + KNOB_ORBIT_R * Math.sin(knobAngle);
    const knobSizePct = KNOB_R * 2;
    return {
      left: `${knobX}%`,
      top: `${knobY}%`,
      width: `${knobSizePct}%`,
      height: `${knobSizePct}%`,
      marginLeft: `${-KNOB_R}%`,
      marginTop: `${-KNOB_R}%`,
    };
  }, [progressClamped]);

  return (
    <View style={styles.progressRing} {...panHandlers}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" pointerEvents="none">
        <Circle
          cx={RING_C}
          cy={RING_C}
          r={RING_R}
          stroke={RING_TRACK}
          strokeWidth={RING_STROKE}
          fill="transparent"
        />
        {progressClamped > 0 ? (
          <Circle
            cx={RING_C}
            cy={RING_C}
            r={RING_R}
            stroke={V.accentSage}
            strokeWidth={RING_STROKE}
            fill="transparent"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={(1 - progressClamped) * RING_CIRC}
            transform={`rotate(-90 ${RING_C} ${RING_C})`}
          />
        ) : null}
      </Svg>
      <View pointerEvents="none" style={[styles.knobDot, knobStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  progressRing: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  knobDot: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: V.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.accentSage,
    zIndex: 20,
    elevation: 20,
  },
});
