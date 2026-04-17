import React from 'react';
import { View, Text } from 'react-native';

const BG = '#0D0F14';

export default function PokerHubScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', opacity: 0.9, fontSize: 16 }}>Poker hub</Text>
    </View>
  );
}

