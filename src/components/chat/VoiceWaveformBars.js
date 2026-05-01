import React, { useState } from 'react';
import { View } from 'react-native';
import { V } from '../../theme';
import { VOICE_WAVE_DIM, VOICE_WAVE_BAR_TARGET, VOICE_WAVE_GAP } from './voiceWaveformSamples';

export default function VoiceWaveformBars({ heights, progress, idle }) {
  const [trackW, setTrackW] = useState(0);
  const list = heights.length > 0 ? heights : Array(VOICE_WAVE_BAR_TARGET).fill(4);
  const n = list.length;
  const barW = trackW > 0 && n > 0 ? Math.max(2, (trackW - (n - 1) * VOICE_WAVE_GAP) / n) : 3;
  const p = Math.min(1, Math.max(0, progress));
  const playedEnd = idle ? 0 : Math.min(n, Math.floor(p * n + 1e-6));
  return (
    <View
      style={{ flex: 1, height: 40, justifyContent: 'flex-end', minWidth: 0 }}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 40 }}>
        {list.map((h, i) => (
          <View
            key={`wv-${i}`}
            style={{
              width: barW,
              height: Math.min(40, Math.max(4, h)),
              marginRight: i === n - 1 ? 0 : VOICE_WAVE_GAP,
              borderRadius: 2,
              backgroundColor: idle ? VOICE_WAVE_DIM : i < playedEnd ? V.accentSage : VOICE_WAVE_DIM,
            }}
          />
        ))}
      </View>
    </View>
  );
}
