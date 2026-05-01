import React, { useContext, useMemo } from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { Flame } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { EphemeralClockContext } from './ephemeralClockContext';

export default function ChatEphemeralCountdown({ expiresAt }) {
  const tick = useContext(EphemeralClockContext);
  const secsLeft = useMemo(
    () => Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 1000)),
    [expiresAt, tick]
  );

  if (secsLeft <= 0) return null;
  const fmt = secsLeft >= 60 ? `${Math.floor(secsLeft / 60)}м ${secsLeft % 60}с` : `${secsLeft}с`;
  return (
    <View style={tw`flex-row items-center ml-1`}>
      <Flame size={9} color={V.accentGold} strokeWidth={1.5} />
      <Text style={[tw`text-[9px] ml-0.5`, { color: V.accentGold }]}>{fmt}</Text>
    </View>
  );
}
