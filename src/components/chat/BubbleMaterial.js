import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { V } from '../../theme';

const BubbleMaterial = React.memo(function BubbleMaterial({
  bubbleMaxW,
  alignSelf,
  bubbleRadii,
  isEphemeral,
  selectionMode,
  noPaddingBottom,
  onPress,
  onLongPress,
  children }) {
  const hasHandlers = !!onPress || !!onLongPress;
  return (
    <View
      collapsable={false}
      style={{
        maxWidth: bubbleMaxW,
        alignSelf }}
    >
      <View
        collapsable={false}
        style={[
          bubbleRadii,
          {
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth * 1.5,
            borderColor: V.border }]}
      >
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: V.inBubbleBg }]}
        />
        {hasHandlers ? (
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={400}
            style={({ pressed }) => [
              {
                minWidth: 60,
                paddingHorizontal: 10,
                paddingTop: 8,
                paddingBottom: noPaddingBottom ? 0 : 8,
                backgroundColor: 'transparent',
                opacity: pressed && !selectionMode ? 0.88 : 1,
                zIndex: 2 },
              isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold }]}
          >
            {children}
          </Pressable>
        ) : (
          <View
            style={[
              {
                minWidth: 60,
                paddingHorizontal: 10,
                paddingTop: 8,
                paddingBottom: noPaddingBottom ? 0 : 8,
                backgroundColor: 'transparent',
                zIndex: 2 },
              isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold }]}
          >
            {children}
          </View>
        )}
      </View>
    </View>
  );
});

export default BubbleMaterial;
