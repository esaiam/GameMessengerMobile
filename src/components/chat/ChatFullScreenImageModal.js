import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Text,
} from 'react-native';
import tw from 'twrnc';
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';

const screenWidth = Dimensions.get('window').width;

const viewabilityConfig = { itemVisiblePercentThreshold: 50 };

export default function ChatFullScreenImageModal({ uiReady, uris, initialIndex, onClose }) {
  const listRef = useRef(null);
  const scrollRetryTimerRef = useRef(null);
  const visible = Array.isArray(uris) && uris.length > 0;
  const safeIndex = visible
    ? Math.min(Math.max(initialIndex, 0), uris.length - 1)
    : 0;
  const [currentIndex, setCurrentIndex] = useState(safeIndex);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(safeIndex);
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: safeIndex, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, safeIndex, uris]);

  useEffect(() => {
    return () => {
      if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    };
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const idx = viewableItems[0]?.index;
    if (idx != null) setCurrentIndex(idx);
  }).current;

  const getItemLayout = useCallback(
    (_, index) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [],
  );

  const handleScrollToIndexFailed = useCallback((info) => {
    listRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
    if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current);
    scrollRetryTimerRef.current = setTimeout(() => {
      scrollRetryTimerRef.current = null;
      listRef.current?.scrollToIndex({ index: info.index, animated: false });
    }, 100);
  }, []);

  if (!uiReady) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={tw`flex-1 bg-black items-center justify-center`} onPress={onClose}>
        {uris.length > 1 ? (
          <Text
            style={[
              tw`absolute top-12 self-center text-sm`,
              { color: V.textPrimary, zIndex: 2 },
            ]}
          >
            {currentIndex + 1} / {uris.length}
          </Text>
        ) : null}
        <FlatList
          ref={listRef}
          data={uris}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => `${item}-${i}`}
          getItemLayout={getItemLayout}
          initialScrollIndex={safeIndex}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          style={{ height: '80%' }}
          renderItem={({ item }) => (
            <Pressable onPress={onClose} style={{ width: screenWidth, height: '100%' }}>
              <Image
                source={{ uri: item }}
                style={{ width: screenWidth, height: '100%' }}
                resizeMode="contain"
              />
            </Pressable>
          )}
        />
        <TouchableOpacity
          style={[
            tw`absolute top-12 right-4 rounded-full p-2`,
            { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={onClose}
        >
          <X size={18} color={V.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}
