import React from 'react';
import { StyleSheet, View } from 'react-native';
import { V } from '../theme';

export default function TabBackground({ children }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V.bgApp,
  },
});

