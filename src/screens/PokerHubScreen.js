import React from 'react';
import { View, StyleSheet } from 'react-native';
import TamagotchiScreen from '../components/tamagotchi/TamagotchiScreen';
import { V } from '../theme';

export default function PokerHubScreen() {
  return (
    <View style={styles.root}>
      <TamagotchiScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V.bgApp } });
