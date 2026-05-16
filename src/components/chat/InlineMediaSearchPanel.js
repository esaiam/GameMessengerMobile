import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import tw from 'twrnc';
import { V } from '../../theme';
import { PIC_INLINE_PANEL_H, PIC_INLINE_COLS } from './chatComposerConstants';

const COL_GAP = 4;
const ROW_GAP = 4;

/**
 * Сетка превью над composer (`@pic` / `@gif`).
 */
export default function InlineMediaSearchPanel({
  visible,
  triggerLabel = '@pic',
  title = 'Поиск',
  needsQueryHint = 'Введите запрос',
  needsQuery,
  loading,
  error,
  results,
  hasMore,
  onSelect,
  onLoadMore,
}) {
  const { width: windowWidth } = useWindowDimensions();

  const cellSize = useMemo(
    () => Math.floor((windowWidth - 16) / PIC_INLINE_COLS - COL_GAP),
    [windowWidth],
  );

  if (!visible) return null;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => onSelect(item)}
      activeOpacity={0.85}
      style={{
        width: cellSize,
        height: cellSize,
        marginRight: COL_GAP,
        marginBottom: ROW_GAP,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: V.bgElevated,
      }}
    >
      <Image
        source={{ uri: item.thumbUrl || item.fullUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const listEmpty = () => {
    if (needsQuery) {
      return (
        <View style={tw`flex-1 items-center justify-center px-4`}>
          <Text style={[tw`text-[13px] text-center`, { color: V.textMuted, fontWeight: '400' }]}>
            {needsQueryHint} {triggerLabel}
          </Text>
        </View>
      );
    }
    if (loading && results.length === 0) {
      return (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator color={V.accentSage} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={tw`flex-1 items-center justify-center px-4`}>
          <Text style={[tw`text-[13px] text-center`, { color: V.textMuted, fontWeight: '400' }]}>
            {error}
          </Text>
        </View>
      );
    }
    return (
      <View style={tw`flex-1 items-center justify-center px-4`}>
        <Text style={[tw`text-[13px] text-center`, { color: V.textMuted, fontWeight: '400' }]}>
          Ничего не найдено
        </Text>
      </View>
    );
  };

  return (
    <View
      style={{
        height: PIC_INLINE_PANEL_H,
        backgroundColor: V.bgSurface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: V.border,
      }}
    >
      <View
        style={[
          tw`flex-row items-center px-3 py-1.5`,
          { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: V.border },
        ]}
      >
        <Text style={[tw`text-[11px]`, { color: V.accentSage, fontWeight: '500' }]}>
          {triggerLabel}
        </Text>
        <Text style={[tw`text-[11px] ml-2 flex-1`, { color: V.textMuted, fontWeight: '400' }]} numberOfLines={1}>
          {title}
        </Text>
        {loading && results.length > 0 ? (
          <ActivityIndicator size="small" color={V.accentSage} />
        ) : null}
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        numColumns={PIC_INLINE_COLS}
        columnWrapperStyle={results.length > 0 ? { paddingHorizontal: 8, paddingTop: 8 } : undefined}
        contentContainerStyle={results.length === 0 ? { flexGrow: 1 } : { paddingBottom: 8 }}
        ListEmptyComponent={listEmpty}
        keyboardShouldPersistTaps="always"
        onEndReached={() => {
          if (hasMore && !loading) onLoadMore?.();
        }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
