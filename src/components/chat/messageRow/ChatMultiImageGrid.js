import React from 'react';
import { View, Text, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { V } from '../../../theme';
import ChatEphemeralCountdown from '../ChatEphemeralCountdown';
import ChatReadCheck from '../ChatReadCheck';
import {
  MSG_TEXT_SIZE,
  MSG_LINE_HEIGHT,
  TS_TEXT_SIZE,
} from '../messageBubbleLayoutConstants';
import { useDoubleTapPress } from './useDoubleTapPress';

const GRID_GAP = 2;
const GRID_RADIUS = 8;

function ChatMultiImageGridCell({
  uri,
  imageIndex,
  width,
  height,
  borderRadii,
  showMoreOverlay,
  moreCount,
  suppressHeavyMedia = false,
  selectionMode,
  item,
  onMessagePress,
  onOpenImage,
  onDoubleTapHeart,
  onLongPress,
}) {
  const handlePress = useDoubleTapPress(
    (e) => {
      if (selectionMode) onMessagePress(e, item);
      else onOpenImage(imageIndex);
    },
    onDoubleTapHeart,
  );

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        multiImageGridStyles.cell,
        { width, height },
        borderRadii,
        pressed && multiImageGridStyles.cellPressed,
      ]}
    >
      {suppressHeavyMedia ? (
        <View style={multiImageGridStyles.cellImage} />
      ) : (
        <Image source={{ uri }} style={multiImageGridStyles.cellImage} resizeMode="cover" />
      )}
      {showMoreOverlay ? (
        <View pointerEvents="none" style={multiImageGridStyles.moreOverlay}>
          <Text style={multiImageGridStyles.moreOverlayText}>+{moreCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ChatMultiImageGrid({
  urls,
  caption,
  layoutMaxWidth,
  formattedTime,
  isRead,
  isMine,
  isEphemeral,
  expiresAt,
  isSelected,
  isUploading,
  selectionMode,
  item,
  onMessagePress,
  onOpenImage,
  onDoubleTapHeart,
  onCaptionPress,
  onLongPress,
  suppressHeavyMedia = false,
  tickPausedRef,
}) {
  const hasCaption = Boolean(String(caption || '').trim());
  const gridW = Math.floor(layoutMaxWidth);
  const half = (gridW - GRID_GAP) / 2;
  const count = urls.length;
  const R = GRID_RADIUS;

  const cellProps = {
    suppressHeavyMedia,
    selectionMode,
    item,
    onMessagePress,
    onOpenImage,
    onDoubleTapHeart,
    onLongPress,
  };

  let gridBody = null;

  if (count === 2) {
    gridBody = (
      <View style={[multiImageGridStyles.row, { width: gridW }]}>
        <ChatMultiImageGridCell
          uri={urls[0]}
          imageIndex={0}
          width={half}
          height={half}
          borderRadii={{ borderTopLeftRadius: R, borderBottomLeftRadius: R }}
          {...cellProps}
        />
        <ChatMultiImageGridCell
          uri={urls[1]}
          imageIndex={1}
          width={half}
          height={half}
          borderRadii={{ borderTopRightRadius: R, borderBottomRightRadius: R }}
          {...cellProps}
        />
      </View>
    );
  } else if (count === 3) {
    gridBody = (
      <View style={{ width: gridW, gap: GRID_GAP }}>
        <ChatMultiImageGridCell
          uri={urls[0]}
          imageIndex={0}
          width={gridW}
          height={half}
          borderRadii={{ borderTopLeftRadius: R, borderTopRightRadius: R }}
          {...cellProps}
        />
        <View style={multiImageGridStyles.row}>
          <ChatMultiImageGridCell
            uri={urls[1]}
            imageIndex={1}
            width={half}
            height={half}
            borderRadii={{ borderBottomLeftRadius: R }}
            {...cellProps}
          />
          <ChatMultiImageGridCell
            uri={urls[2]}
            imageIndex={2}
            width={half}
            height={half}
            borderRadii={{ borderBottomRightRadius: R }}
            {...cellProps}
          />
        </View>
      </View>
    );
  } else {
    const visible = urls.slice(0, 4);
    const extraCount = count - 4;
    gridBody = (
      <View style={{ width: gridW, gap: GRID_GAP }}>
        <View style={multiImageGridStyles.row}>
          <ChatMultiImageGridCell
            uri={visible[0]}
            imageIndex={0}
            width={half}
            height={half}
            borderRadii={{ borderTopLeftRadius: R }}
            {...cellProps}
          />
          <ChatMultiImageGridCell
            uri={visible[1]}
            imageIndex={1}
            width={half}
            height={half}
            borderRadii={{ borderTopRightRadius: R }}
            {...cellProps}
          />
        </View>
        <View style={multiImageGridStyles.row}>
          <ChatMultiImageGridCell
            uri={visible[2]}
            imageIndex={2}
            width={half}
            height={half}
            borderRadii={{ borderBottomLeftRadius: R }}
            {...cellProps}
          />
          <ChatMultiImageGridCell
            uri={visible[3]}
            imageIndex={3}
            width={half}
            height={half}
            borderRadii={{ borderBottomRightRadius: R }}
            showMoreOverlay={extraCount > 0}
            moreCount={extraCount}
            {...cellProps}
          />
        </View>
      </View>
    );
  }

  const wrapPress = (child, pressHandler) => {
    if (!pressHandler && !onLongPress) return child;
    return (
      <Pressable
        onPress={pressHandler}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => (pressed ? multiImageGridStyles.cellPressed : null)}
      >
        {child}
      </Pressable>
    );
  };

  return (
    <View style={{ maxWidth: gridW, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
      <View
        style={[
          multiImageGridStyles.gridWrap,
          { width: gridW },
          isEphemeral && multiImageGridStyles.gridWrapEphemeral,
          isSelected && multiImageGridStyles.gridWrapSelected,
        ]}
      >
        {gridBody}
        {isUploading ? (
          <View pointerEvents="none" style={multiImageGridStyles.uploadOverlay}>
            <ActivityIndicator color={V.accentSage} size="small" />
          </View>
        ) : null}
        <View pointerEvents="none" style={multiImageGridStyles.metaOverlay}>
          {isEphemeral ? (
            <ChatEphemeralCountdown expiresAt={expiresAt} tickPausedRef={tickPausedRef} />
          ) : null}
          <Text style={multiImageGridStyles.timeText}>{formattedTime}</Text>
          <ChatReadCheck isRead={isRead} isMine={isMine} variant="overlay" />
        </View>
      </View>
      {hasCaption
        ? wrapPress(
            <View
              style={[
                multiImageGridStyles.captionBox,
                { maxWidth: gridW },
                isMine ? multiImageGridStyles.captionBoxMine : multiImageGridStyles.captionBoxTheir,
                isEphemeral && multiImageGridStyles.gridWrapEphemeral,
                isSelected && multiImageGridStyles.gridWrapSelected,
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
            onCaptionPress,
          )
        : null}
    </View>
  );
}

const multiImageGridStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    backgroundColor: V.bgElevated,
  },
  gridWrapEphemeral: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: V.accentGold,
  },
  gridWrapSelected: {
    borderWidth: 2,
    borderColor: V.accentSage,
  },
  cell: {
    overflow: 'hidden',
    backgroundColor: V.bgElevated,
  },
  cellPressed: {
    opacity: 0.92,
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  moreOverlayText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    zIndex: 2,
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
    zIndex: 3,
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
    borderRadius: GRID_RADIUS,
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

export default ChatMultiImageGrid;
