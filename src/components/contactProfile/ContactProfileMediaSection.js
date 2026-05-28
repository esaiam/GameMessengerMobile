import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Play, Check } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { isGifMediaUrl } from '../../lib/isGifMediaUrl';

const COLS = 3;
/** Совпадает с paddingHorizontal скролла ContactProfileScreen */
const SCROLL_HORIZONTAL_PAD = 16;
const MEDIA_GRID_RADIUS = 20;
const TILE_SELECT_SCALE = 0.88;
const SELECTION_BADGE_SIZE = 22;
const SELECT_SPRING = { damping: 18, stiffness: 280, mass: 0.85 };

function MediaTile({
  item,
  selectionMode,
  isSelected,
  isHiddenInGrid,
  onPress,
  onLongPress,
  onTileLayout,
  onRegisterTransitionSource,
}) {
  const tileRef = useRef(null);
  const isVideo = item.message_type === 'video';
  const isGif = !isVideo && isGifMediaUrl(item.media_url);
  const [thumbUri, setThumbUri] = useState(isVideo ? null : item.media_url);
  const [thumbLoading, setThumbLoading] = useState(isVideo);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!isVideo || !item.media_url) {
      setThumbUri(item.media_url);
      setThumbLoading(false);
      return undefined;
    }
    let cancelled = false;
    setThumbLoading(true);
    const timer = setTimeout(() => {
      VideoThumbnails.getThumbnailAsync(item.media_url, { time: 0 })
        .then(({ uri }) => {
          if (!cancelled) {
            setThumbUri(uri);
            setThumbLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setThumbLoading(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isVideo, item.media_url]);

  useEffect(() => {
    const shrink = selectionMode && isSelected;
    scale.value = withSpring(shrink ? TILE_SELECT_SCALE : 1, SELECT_SPRING);
  }, [selectionMode, isSelected, scale]);

  const tileAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const measureNow = useCallback(
    (cb) => {
      tileRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          const layout = { x, y, width, height };
          onTileLayout?.(item.id, layout);
          cb?.(layout);
        } else {
          cb?.(null);
        }
      });
    },
    [item.id, onTileLayout],
  );

  useEffect(() => {
    if (!onRegisterTransitionSource) return undefined;
    onRegisterTransitionSource(item.id, measureNow);
    return () => onRegisterTransitionSource(item.id, null);
  }, [item.id, measureNow, onRegisterTransitionSource]);

  const handlePress = useCallback(() => {
    measureNow((layout) => {
      onPress?.(item, layout);
    });
  }, [item, measureNow, onPress]);

  return (
    <Pressable
      style={styles.tile}
      onPress={handlePress}
      onLongPress={() => onLongPress?.(item)}
      delayLongPress={380}
      disabled={!item.media_url}
      pointerEvents={isHiddenInGrid ? 'none' : 'auto'}
      accessibilityRole="button"
      accessibilityLabel={
        selectionMode
          ? isSelected
            ? 'Снять выделение'
            : 'Выделить'
          : isVideo
            ? 'Открыть видео'
            : 'Открыть фото'
      }
    >
      <Animated.View
        ref={tileRef}
        style={[
          styles.tileInner,
          tileAnimStyle,
          { backgroundColor: V.bgElevated },
        ]}
      >
        {thumbUri ? (
          <View pointerEvents="none" style={styles.tileImage}>
            <Image
              source={{ uri: thumbUri }}
              style={[styles.mediaFill, isHiddenInGrid && styles.tileThumbHidden]}
              resizeMode="cover"
              fadeDuration={0}
            />
          </View>
        ) : (
          <View pointerEvents="none" style={styles.tileImage} />
        )}
        {!isHiddenInGrid && thumbLoading ? (
          <View style={styles.tileLoader}>
            <ActivityIndicator size="small" color={V.accentSage} />
          </View>
        ) : null}
        {selectionMode && isSelected ? (
          <View style={styles.selectionBadge}>
            <Check size={12} color={V.bgApp} strokeWidth={2.5} />
          </View>
        ) : null}
        {isVideo && !isHiddenInGrid && !(selectionMode && isSelected) ? (
          <View pointerEvents="none" style={styles.videoBadge}>
            <Play size={18} color={V.textPrimary} strokeWidth={1.5} />
          </View>
        ) : null}
        {isGif && !isHiddenInGrid && !(selectionMode && isSelected) ? (
          <View pointerEvents="none" style={styles.gifBadge}>
            <Text style={styles.gifBadgeText}>GIF</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function MediaRow({
  items,
  selectionMode,
  selectedIds,
  hiddenTileId,
  onMediaPress,
  onMediaLongPress,
  onTileLayout,
  onRegisterTransitionSource,
}) {
  const slots = [...items];
  while (slots.length < COLS) {
    slots.push(null);
  }

  return (
    <View style={styles.row}>
      {slots.slice(0, COLS).map((item, i) =>
        item ? (
          <MediaTile
            key={item.id}
            item={item}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(item.id)}
            isHiddenInGrid={hiddenTileId === item.id}
            onPress={onMediaPress}
            onLongPress={onMediaLongPress}
            onTileLayout={onTileLayout}
            onRegisterTransitionSource={onRegisterTransitionSource}
          />
        ) : (
          <View key={`empty-${i}`} style={styles.tile} />
        ),
      )}
    </View>
  );
}

export default function ContactProfileMediaSection({
  items,
  loading,
  roomId,
  selectionMode,
  selectedIds,
  hiddenTileId,
  onMediaPress,
  onMediaLongPress,
  onTileLayout,
  onRegisterTransitionSource,
}) {
  const rows = [];
  for (let i = 0; i < items.length; i += COLS) {
    rows.push(items.slice(i, i + COLS));
  }

  const { width: screenW } = useWindowDimensions();

  if (!roomId) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: V.textSecondary }]}>МЕДИА</Text>
      <View
        style={[
          styles.grid,
          {
            width: screenW,
            marginHorizontal: -SCROLL_HORIZONTAL_PAD,
            borderRadius: MEDIA_GRID_RADIUS,
          },
        ]}
      >
        {loading && items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={V.accentSage} size="small" />
          </View>
        ) : null}
        {!loading && items.length === 0 ? (
          <Text style={[styles.emptyText, { color: V.textMuted }]}>
            Нет фото и видео в переписке
          </Text>
        ) : null}
        {rows.map((row, rowIdx) => (
          <MediaRow
            key={`row-${rowIdx}`}
            items={row}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            hiddenTileId={hiddenTileId}
            onMediaPress={onMediaPress}
            onMediaLongPress={onMediaLongPress}
            onTileLayout={onTileLayout}
            onRegisterTransitionSource={onRegisterTransitionSource}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 6,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  grid: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileInner: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  tileImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaFill: {
    width: '100%',
    height: '100%',
  },
  tileThumbHidden: {
    opacity: 0,
  },
  tileLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  selectionBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: SELECTION_BADGE_SIZE,
    height: SELECTION_BADGE_SIZE,
    borderRadius: SELECTION_BADGE_SIZE / 2,
    backgroundColor: V.accentSage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: V.bgApp,
    zIndex: 4,
  },
  videoBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  gifBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gifBadgeText: {
    fontSize: 9,
    fontWeight: '500',
    color: V.textPrimary,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  emptyWrap: {
    flex: 1,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '400',
    paddingVertical: 20,
    paddingHorizontal: 12,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
});
