import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { V } from '../../theme';
import BubbleLinearGradient from './BubbleLinearGradient';

const BUBBLE_EDGE_SOFT = 'rgba(110, 195, 185, 0.07)';

const outgoingBubbleStyles = StyleSheet.create({
  outer: {
    alignSelf: 'flex-end' },
  inner: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderColor: BUBBLE_EDGE_SOFT },
  gloss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.04)' },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
    backgroundColor: 'rgba(0,0,0,0.03)' },
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
      style={[outgoingBubbleStyles.outer, { maxWidth: bubbleMaxW }]}
      collapsable={false}
      testID={message?.id ? `outgoing-bubble-${message.id}` : undefined}
    >
      <View style={[bubbleRadii, outgoingBubbleStyles.inner]} collapsable={false}>
        <BubbleLinearGradient colors={V.outBubbleGradient} />
        <View pointerEvents="none" style={outgoingBubbleStyles.gloss} />
        <View pointerEvents="none" style={outgoingBubbleStyles.shade} />
        {hasHandlers ? (
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={400}
            style={({ pressed }) => [
              outgoingBubbleStyles.pressable,
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
              outgoingBubbleStyles.pressable,
              noPaddingBottom && { paddingBottom: 0 },
              isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold },
              isSelected && { borderWidth: 2, borderColor: V.accentSage }]}
          >
            {children}
          </View>
        )}
      </View>
    </View>
  );
}

export default React.memo(OutgoingBubble);
