import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { V } from '../../theme';

const incomingNeu = StyleSheet.create({
  shell: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4 },
  gradient: {
    overflow: 'hidden',
    backgroundColor: V.inBubbleFillBR,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.4)' } });

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
      <View collapsable={false} style={[bubbleRadii, incomingNeu.shell]}>
        <LinearGradient
          colors={[V.inBubbleFillTL, V.inBubbleFillBR]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[bubbleRadii, incomingNeu.gradient]}
        >
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
        </LinearGradient>
      </View>
    </View>
  );
});

export default BubbleMaterial;
