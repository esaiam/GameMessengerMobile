import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { V } from '../theme';

const TAB_BG_IMAGE = require('../../assets/tab-bg.jpg');

export default function TabBackground({ children }) {
  return (
    <View style={styles.root}>
      <View style={styles.imageWrap} pointerEvents="none">
      <Image
        source={TAB_BG_IMAGE}
        resizeMode="contain"
        style={styles.image}
        accessibilityIgnoresInvertColors
      />
      </View>
      <View style={styles.dim} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V.bgApp,
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 2 }, { translateY: 80 }],
    opacity: 0.08575, // прозрачность самой картинки 8.575%
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: V.bgApp,
    opacity: 0.08575, // доп. тусклость/затемнение 8.575%
  },
  content: {
    flex: 1,
  },
});

