import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder } from 'react-native';
import { SEARCH_FIELD_LAYOUT } from '../theme';

const SEARCH_HIDE_THRESHOLD_PX = 12;
const SEARCH_HIDE_GAP_PX = 8;

/** Отступ под полем поиска до списка (используется в ChatsScreen для paddingTop FlatList). */
export const CHATS_SEARCH_BOTTOM_SPACING_PX = 20;

export function useChatsSearchReveal(q, searchFocused) {
  const SEARCH_FIELD_H = SEARCH_FIELD_LAYOUT.chatsHeight;

  const [searchPointerEvents, setSearchPointerEvents] = useState('auto');
  const searchReveal = useRef(new Animated.Value(1)).current;
  const lastScrollYRef = useRef(0);
  const searchShownRef = useRef(true);
  const accumDyRef = useRef(0);
  const lastDirRef = useRef(0);
  const [listViewportH, setListViewportH] = useState(0);
  const [listContentH, setListContentH] = useState(0);
  const isScrollable = listContentH > listViewportH + 1;
  const isScrollableRef = useRef(isScrollable);
  const gestureLastDyRef = useRef(0);

  const setSearchShown = useCallback(
    (shown) => {
      if (!shown) {
        if (q.trim().length > 0 || searchFocused) return;
      }
      if (searchShownRef.current === shown) return;
      searchShownRef.current = shown;
      setSearchPointerEvents(shown ? 'auto' : 'none');
      Animated.timing(searchReveal, {
        toValue: shown ? 1 : 0,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true }).start();
    },
    [q, searchFocused, searchReveal]
  );

  useEffect(() => {
    if (q.trim().length > 0 || searchFocused) setSearchShown(true);
  }, [q, searchFocused, setSearchShown]);

  useEffect(() => {
    isScrollableRef.current = isScrollable;
  }, [isScrollable]);

  const onListScroll = useCallback(
    (e) => {
      const y = e?.nativeEvent?.contentOffset?.y ?? 0;
      const last = lastScrollYRef.current;
      const dy = y - last;
      const dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;
      lastScrollYRef.current = y;

      if (y <= 0) {
        setSearchShown(true);
        accumDyRef.current = 0;
        lastDirRef.current = 0;
        return;
      }

      if (dir !== 0 && dir !== lastDirRef.current) {
        accumDyRef.current = 0;
        lastDirRef.current = dir;
      }

      if (dir === -1) {
        if (dy < -1) setSearchShown(true);
        return;
      }

      if (dir === 1) {
        accumDyRef.current += dy;
        if (accumDyRef.current > SEARCH_HIDE_THRESHOLD_PX) {
          setSearchShown(false);
          accumDyRef.current = 0;
        }
      }
    },
    [setSearchShown]
  );

  const onVirtualScrollDy = useCallback(
    (dy) => {
      const dir = dy > 0 ? 1 : dy < 0 ? -1 : 0;

      if (dir !== 0 && dir !== lastDirRef.current) {
        accumDyRef.current = 0;
        lastDirRef.current = dir;
      }

      if (dir === -1) {
        if (dy < -1) setSearchShown(true);
        return;
      }

      if (dir === 1) {
        accumDyRef.current += dy;
        if (accumDyRef.current > SEARCH_HIDE_THRESHOLD_PX) {
          setSearchShown(false);
          accumDyRef.current = 0;
        }
      }
    },
    [setSearchShown]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (isScrollableRef.current) return false;
          const { dx, dy } = gestureState;
          const isVertical = Math.abs(dy) > 2 && Math.abs(dy) > Math.abs(dx);
          if (!isVertical) return false;

          if (dy < 0) return true;
          return !searchShownRef.current;
        },
        onPanResponderGrant: () => {
          gestureLastDyRef.current = 0;
          accumDyRef.current = 0;
          lastDirRef.current = 0;
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (isScrollableRef.current) return;
          const currentFingerDy = gestureState.dy || 0;
          const deltaFingerDy = currentFingerDy - gestureLastDyRef.current;
          gestureLastDyRef.current = currentFingerDy;

          const virtualDy = -deltaFingerDy;
          onVirtualScrollDy(virtualDy);
        },
        onPanResponderRelease: () => {
          gestureLastDyRef.current = 0;
          accumDyRef.current = 0;
          lastDirRef.current = 0;
        },
        onPanResponderTerminate: () => {
          gestureLastDyRef.current = 0;
          accumDyRef.current = 0;
          lastDirRef.current = 0;
        } }),
    [onVirtualScrollDy]
  );

  const searchTranslateY = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [-(SEARCH_FIELD_H + SEARCH_HIDE_GAP_PX), 0] }),
    [searchReveal, SEARCH_FIELD_H]
  );

  const searchOpacity = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1] }),
    [searchReveal]
  );

  const iconOpacity = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0] }),
    [searchReveal]
  );

  const listTranslateY = useMemo(
    () =>
      searchReveal.interpolate({
        inputRange: [0, 1],
        outputRange: [-(SEARCH_FIELD_H + CHATS_SEARCH_BOTTOM_SPACING_PX), 0] }),
    [searchReveal, SEARCH_FIELD_H]
  );

  return {
    SEARCH_FIELD_H,
    searchPointerEvents,
    setSearchShown,
    panResponder,
    onListScroll,
    searchTranslateY,
    searchOpacity,
    iconOpacity,
    listTranslateY,
    setListViewportH,
    setListContentH };
}
