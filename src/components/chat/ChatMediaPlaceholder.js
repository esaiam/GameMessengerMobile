import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ImageIcon } from '../../icons/lucideIcons';
import { V } from '../../theme';
import ChatReadCheck from './ChatReadCheck';
import ChatEphemeralCountdown from './ChatEphemeralCountdown';
import { TS_TEXT_SIZE, MSG_TEXT_SIZE, MSG_LINE_HEIGHT } from './messageBubbleLayoutConstants';
import { computeChatMediaLayout } from '../../lib/computeChatMediaLayout';

const MEDIA_RADIUS = 12;
const PLACEHOLDER_ICON_SIZE = 22;

/**
 * Chrome фото/GIF в ленте без decode `<Image>` — для tablet GameScreen при открытой доске.
 */
export default function ChatMediaPlaceholder({
  caption,
  formattedTime,
  isRead,
  isMine,
  isGif = false,
  layoutMaxWidth,
  isEphemeral,
  expiresAt,
  isSelected,
  isUploading = false,
  onPress,
  onCaptionPress,
  onLongPress,
  delayLongPress = 400,
  tickPausedRef,
}) {
  const hasCaption = Boolean(String(caption || '').trim());
  const layout = useMemo(
    () => computeChatMediaLayout(0, 0, layoutMaxWidth, { isGif }),
    [layoutMaxWidth, isGif],
  );

  const frameStyle = useMemo(
    () => ({
      width: layout.width,
      height: layout.height,
    }),
    [layout.width, layout.height],
  );

  const mediaBody = (
    <View
      style={[
        styles.mediaFrame,
        frameStyle,
        isEphemeral && styles.mediaFrameEphemeral,
        isSelected && styles.mediaFrameSelected,
      ]}
    >
      <View style={styles.placeholderCenter} pointerEvents="none">
        <ImageIcon size={PLACEHOLDER_ICON_SIZE} color={V.textMuted} strokeWidth={1.5} />
      </View>
      {isUploading ? (
        <View pointerEvents="none" style={styles.uploadOverlay}>
          <ActivityIndicator color={V.accentSage} size="small" />
        </View>
      ) : null}
      {isGif ? (
        <View pointerEvents="none" style={styles.gifBadge}>
          <Text style={styles.gifBadgeText}>GIF</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.metaOverlay}>
        {isEphemeral ? (
          <ChatEphemeralCountdown expiresAt={expiresAt} tickPausedRef={tickPausedRef} />
        ) : null}
        <Text style={styles.timeText}>{formattedTime}</Text>
        <ChatReadCheck isRead={isRead} isMine={isMine} variant="overlay" />
      </View>
    </View>
  );

  const wrapPress = (child, pressHandler) => {
    if (!pressHandler && !onLongPress) return child;
    return (
      <Pressable
        onPress={pressHandler}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
      >
        {child}
      </Pressable>
    );
  };

  const captionPress = onCaptionPress ?? onPress;

  return (
    <View style={{ maxWidth: layoutMaxWidth, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
      {wrapPress(mediaBody, onPress)}
      {hasCaption ? (
        wrapPress(
          <View
            style={[
              styles.captionBox,
              { maxWidth: layout.width },
              isMine ? styles.captionBoxMine : styles.captionBoxTheir,
              isEphemeral && styles.mediaFrameEphemeral,
              isSelected && styles.mediaFrameSelected,
            ]}
          >
            <Text
              style={{
                fontSize: MSG_TEXT_SIZE,
                fontWeight: '400',
                lineHeight: MSG_LINE_HEIGHT,
                color: V.textPrimary,
              }}
            >
              {caption}
            </Text>
          </View>,
          captionPress,
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },
  mediaFrame: {
    borderRadius: MEDIA_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    backgroundColor: V.bgElevated,
  },
  mediaFrameEphemeral: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: V.accentGold,
  },
  mediaFrameSelected: {
    borderWidth: 2,
    borderColor: V.accentSage,
  },
  placeholderCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 2,
  },
  gifBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  gifBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 0.4,
  },
  metaOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  timeText: {
    fontSize: TS_TEXT_SIZE,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.88)',
  },
  captionBox: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: MEDIA_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
  },
  captionBoxMine: {
    backgroundColor: V.bgElevated,
  },
  captionBoxTheir: {
    backgroundColor: V.inBubbleBg,
  },
});
