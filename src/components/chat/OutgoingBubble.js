import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { V } from '../../theme';

const outgoingNeu = StyleSheet.create({
  outer: {
    alignSelf: 'flex-end' },
  shell: {
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4 },
  gradient: {
    overflow: 'hidden',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.22)',
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(255,255,255,0.15)',
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(0,0,0,0.2)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.35)' },
  pressable: {
    minWidth: 60,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 2 } });

function OutgoingBubble({
  message,
  bubbleMaxW,
  bubbleRadii,
  isEphemeral,
  isSelected,
  selectionMode,
  noPaddingBottom,
  onPress,
  onLongPress,
  children }) {
  const hasHandlers = !!onPress || !!onLongPress;
  return (
    <View
      style={[outgoingNeu.outer, { maxWidth: bubbleMaxW }]}
      collapsable={false}
      testID={message?.id ? `outgoing-bubble-${message.id}` : undefined}
    >
      <View style={[bubbleRadii, outgoingNeu.shell]} collapsable={false}>
        <LinearGradient
          colors={['rgba(90,168,162,0.95)', 'rgba(55,115,110,0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[bubbleRadii, outgoingNeu.gradient]}
        >
          {hasHandlers ? (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              delayLongPress={400}
              style={({ pressed }) => [
                outgoingNeu.pressable,
                noPaddingBottom && { paddingBottom: 0 },
                { opacity: pressed && !selectionMode ? 0.88 : 1 },
                isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold },
                isSelected && { borderWidth: 2, borderColor: V.accentSage }]}
            >
              {children}
            </Pressable>
          ) : (
            <View
              style={[
                outgoingNeu.pressable,
                noPaddingBottom && { paddingBottom: 0 },
                isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold },
                isSelected && { borderWidth: 2, borderColor: V.accentSage }]}
            >
              {children}
            </View>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}

export default React.memo(OutgoingBubble);
