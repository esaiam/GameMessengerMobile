import React from 'react';
import { StyleSheet, View } from 'react-native';
import { V } from '../theme';

export default function TabBackground({ children, backgroundColor = V.bgChatsScreen, testID }) {
  return (
    <View testID={testID} style={[styles.root, { backgroundColor }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'visible' } });

