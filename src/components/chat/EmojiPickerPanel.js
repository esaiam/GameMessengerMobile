import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions } from 'react-native';
import tw from 'twrnc';
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';
import {
  EMOJI_SET,
  EMOJI_PANEL_GIF_COLS,
  EMOJI_PANEL_ISLAND_H,
  EMOJI_PANEL_SEARCH_H,
  EMOJI_PANEL_SEARCH_RADIUS } from './chatComposerConstants';

const COL_GAP = 4;
const ROW_GAP = 4;
const ISLAND_RADIUS = 22;
const ISLAND_SEGMENT_RADIUS = 18;
const MIN_GIF_SEARCH_LEN = 2;

function PanelIsland({ tab, onTabChange, showGifTab }) {
  if (!showGifTab) return null;

  const segments = [
    { id: 'emoji', label: 'Эмодзи' },
    { id: 'gif', label: 'GIF' }];

  return (
    <View style={tw`items-center pt-1 pb-2`}>
      <View
        style={{
          flexDirection: 'row',
          height: EMOJI_PANEL_ISLAND_H,
          padding: 3,
          borderRadius: ISLAND_RADIUS,
          backgroundColor: V.bgElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: V.border }}
      >
        {segments.map((seg) => {
          const active = tab === seg.id;
          return (
            <TouchableOpacity
              key={seg.id}
              onPress={() => onTabChange(seg.id)}
              activeOpacity={0.85}
              style={{
                minWidth: 76,
                paddingHorizontal: 16,
                borderRadius: ISLAND_SEGMENT_RADIUS,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? V.bgSurface : 'transparent' }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '500' : '400',
                  color: active ? V.accentSage : V.textMuted}}
              >
                {seg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function GifSearchBar({ query, onQueryChange, onFocus, onBlur, inputRef }) {
  const armExpand = () => onFocus?.();
  const hasQuery = String(query || '').length > 0;

  return (
    <View
      style={[
        tw`mx-3 mt-1.5 mb-1.5 px-3 flex-row items-center`,
        {height: EMOJI_PANEL_SEARCH_H,
          borderRadius: EMOJI_PANEL_SEARCH_RADIUS,
          backgroundColor: V.bgElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: V.border}]}
    >
      <TextInput
        ref={inputRef}
        value={query}
        onChangeText={onQueryChange}
        onPressIn={armExpand}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Поиск GIF…"
        placeholderTextColor={V.textGhost}
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '400',
          color: V.textPrimary,
          paddingVertical: 0,
          paddingRight: hasQuery ? 4 : 0}}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {hasQuery ? (
        <TouchableOpacity
          onPress={() => onQueryChange?.('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={tw`p-1`}
          accessibilityLabel="Очистить поиск"
        >
          <X size={16} color={V.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function EmojiGrid({ onInsert }) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={tw`flex-row flex-wrap px-2 pt-1 pb-1`}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      {EMOJI_SET.map((emoji, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onInsert(emoji)}
          style={{
            width: '12.5%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 6 }}
        >
          <Text style={[tw`text-2xl`, { }]}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function GifResultsGrid({
  data,
  isSearchMode,
  loading,
  error,
  hasMore,
  onSelect,
  onLoadMore }) {
  const { width: windowWidth } = useWindowDimensions();
  const cellSize = useMemo(
    () => Math.floor((windowWidth - 16) / EMOJI_PANEL_GIF_COLS - COL_GAP),
    [windowWidth],
  );

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
    if (isSearchMode) {
      if (loading) {
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
    }
    if (loading) {
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
          Не удалось загрузить GIF
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      numColumns={EMOJI_PANEL_GIF_COLS}
      columnWrapperStyle={data.length > 0 ? { paddingHorizontal: 8, paddingTop: 4 } : undefined}
      contentContainerStyle={data.length === 0 ? { flexGrow: 1 } : { paddingBottom: 4 }}
      ListEmptyComponent={listEmpty}
      keyboardShouldPersistTaps="always"
      onEndReached={() => {
        if (hasMore && !loading) onLoadMore?.();
      }}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    />
  );
}

/**
 * Контент панели под composer: поиск сверху (GIF), сетка, островок снизу.
 */
export default function EmojiPickerPanel({
  insertEmoji,
  ariaTextOnly = false,
  gifQuery = '',
  onGifQueryChange,
  gifLoading = false,
  gifError = null,
  gifResults = [],
  gifHasMore = false,
  trendingGifs = [],
  onGifSelect,
  onGifLoadMore,
  onGifSearchFocus,
  onGifSearchBlur,
  onGifTabExit }) {
  const [tab, setTab] = useState('emoji');
  const gifSearchRef = useRef(null);
  const gifSearchFocusedRef = useRef(false);
  const showGifTab = !ariaTextOnly;

  const gifSearchActive = String(gifQuery || '').trim().length >= MIN_GIF_SEARCH_LEN;
  const gifGridData = gifSearchActive ? gifResults : trendingGifs;

  useEffect(() => {
    if (!showGifTab && tab === 'gif') setTab('emoji');
  }, [showGifTab, tab]);

  const handleTabChange = (next) => {
    if (next === 'emoji' && tab === 'gif') {
      if (gifSearchFocusedRef.current) {
        gifSearchRef.current?.blur();
      } else {
        onGifTabExit?.();
      }
    }
    setTab(next);
  };

  const isGifTab = tab === 'gif' && showGifTab;

  return (
    <View style={{ flex: 1 }}>
      {isGifTab ? (
        <GifSearchBar
          inputRef={gifSearchRef}
          query={gifQuery}
          onQueryChange={onGifQueryChange}
          onFocus={() => {
            gifSearchFocusedRef.current = true;
            onGifSearchFocus?.();
          }}
          onBlur={() => {
            gifSearchFocusedRef.current = false;
            onGifSearchBlur?.();
          }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        {isGifTab ? (
          <GifResultsGrid
            data={gifGridData}
            isSearchMode={gifSearchActive}
            loading={gifLoading}
            error={gifError}
            hasMore={gifHasMore}
            onSelect={onGifSelect}
            onLoadMore={onGifLoadMore}
          />
        ) : (
          <EmojiGrid onInsert={insertEmoji} />
        )}
      </View>
      <PanelIsland tab={tab} onTabChange={handleTabChange} showGifTab={showGifTab} />
    </View>
  );
}
