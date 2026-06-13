import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import { Flame } from '../../icons/lucideIcons';
import { V } from '../../theme';

function secsUntilExpiry(expiresAt) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatSecsLeft(secsLeft) {
  return secsLeft >= 60 ? `${Math.floor(secsLeft / 60)}м ${secsLeft % 60}с` : `${secsLeft}с`;
}

/**
 * Локальный 1с-тик только для этой ячейки (без global Context / ререндера Chat shell).
 * tickPausedRef — GameScreen: пауза во время 3D-броска кубиков.
 */
function ChatEphemeralCountdown({ expiresAt, tickPausedRef }) {
  const [secsLeft, setSecsLeft] = useState(() => secsUntilExpiry(expiresAt));

  useEffect(() => {
    let left = secsUntilExpiry(expiresAt);
    setSecsLeft(left);
    if (left <= 0) return undefined;

    const id = setInterval(() => {
      if (tickPausedRef?.current) return;
      left = secsUntilExpiry(expiresAt);
      setSecsLeft(left);
      if (left <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt, tickPausedRef]);

  if (secsLeft <= 0) return null;

  return (
    <View style={tw`flex-row items-center ml-1`}>
      <Flame size={9} color={V.accentGold} strokeWidth={1.5} />
      <Text style={[tw`text-[9px] ml-0.5`, { color: V.accentGold }]}>{formatSecsLeft(secsLeft)}</Text>
    </View>
  );
}

export default React.memo(ChatEphemeralCountdown);
