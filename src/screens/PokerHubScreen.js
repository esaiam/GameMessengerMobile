import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V } from '../theme';

export default function PokerHubScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.placeholder}>Скоро</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.bgApp,
  },
  placeholder: {
    color: V.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
