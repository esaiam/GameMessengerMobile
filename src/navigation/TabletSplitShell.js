import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { V } from '../theme';
import { useIsSplitLayout } from '../hooks/useIsSplitLayout';
import {
  SplitDetailContext,
  SplitDetailProvider,
  useSplitDetail,
  splitDetailApi } from '../context/SplitDetailContext';
import GameScreen from '../screens/GameScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ContactProfileScreen from '../screens/ContactProfileScreen';

const MASTER_PORTRAIT_RATIO = 0.45;

/** Декоративные кольца на пустом detail-экране */
function DetailBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      <View style={[styles.ring, { width: 480, height: 480, borderRadius: 240, opacity: 0.04, top: -80, right: -120 }]} />
      <View style={[styles.ring, { width: 320, height: 320, borderRadius: 160, opacity: 0.035, top: 60, right: -20 }]} />
      <View style={[styles.ring, { width: 520, height: 520, borderRadius: 260, opacity: 0.03, bottom: -100, left: -80 }]} />
      <View style={[styles.ring, { width: 200, height: 200, borderRadius: 100, opacity: 0.04, bottom: 140, left: 60 }]} />
    </View>
  );
}

const SCREEN_MAP = {
  Room: GameScreen,
  ChatRoom: ChatRoomScreen,
  ContactProfile: ContactProfileScreen };

/**
 * Fake navigation для экранов в detail-панели.
 *
 * navigate(name, params) → pushDetail — открывает экран поверх текущего
 * goBack()               → popDetail  — возвращает к предыдущему экрану
 *
 * useFocusEffect в GameScreen: isFocused()=true + addListener no-op
 * → effect запускается на mount, cleanup — на unmount. Корректное поведение.
 */
function useFakeNavigation(pushDetail, popDetail) {
  return useMemo(
    () => ({
      isFocused: () => true,
      addListener: () => () => {},
      removeListener: () => {},
      dispatch: () => {},
      navigate: (name, params) => {
        if (SCREEN_MAP[name]) {
          pushDetail({ type: name, params });
        }
      },
      goBack: () => popDetail(),
      setOptions: () => {},
      canGoBack: () => true,
      getParent: () => null,
      getState: () => null,
      getId: () => 'split-detail',
      reset: () => {},
      replace: () => {},
      emit: () => ({ defaultPrevented: false }) }),
    [pushDetail, popDetail]
  );
}

/**
 * Правая колонка split-экрана.
 * Читает currentDetail из SplitDetailContext и рендерит соответствующий экран.
 * Поддерживает мини-стек: Room → ContactProfile → назад → Room.
 */
function DetailPanel({ panelStyle }) {
  const { currentDetail, pushDetail, popDetail } = useSplitDetail();
  const fakeNavigation = useFakeNavigation(pushDetail, popDetail);

  if (!currentDetail) {
    return (
      <View style={[panelStyle, styles.detailCenter]}>
        <DetailBackground />
        <Text style={styles.placeholder}>Выберите чат</Text>
      </View>
    );
  }

  const Screen = SCREEN_MAP[currentDetail.type];
  if (!Screen) return null;

  const screenKey = `detail-${currentDetail.type}-${currentDetail.params?.roomId ?? currentDetail.params?.peerName ?? 'unknown'}`;

  const fakeRoute = {
    key: screenKey,
    name: currentDetail.type,
    params: currentDetail.params };

  return (
    <View style={panelStyle}>
      <NavigationContext.Provider value={fakeNavigation}>
        <Screen
          key={screenKey}
          route={fakeRoute}
          navigation={fakeNavigation}
        />
      </NavigationContext.Provider>
    </View>
  );
}

/**
 * Структурная оболочка split-режима.
 *
 * На телефоне (shortestSide < SPLIT_BREAKPOINT): children как есть — ноль изменений.
 * На планшете: [Master | Detail]. В портрете — 45% / 55%, в альбоме — 1:2.
 *
 * Предоставляет SplitDetailContext вниз по дереву.
 * ChatsScreen и ContactsScreen читают его, чтобы открывать экраны
 * в правой колонке вместо навигационного push.
 */
export function TabletSplitShell({ children }) {
  const isSplit = useIsSplitLayout();
  const { height, width: windowW } = useWindowDimensions();
  const isPortrait = height > windowW;
  const layoutKey = `${Math.round(windowW)}x${Math.round(height)}`;

  const { masterStyle, detailStyle } = useMemo(() => {
    if (!isPortrait) {
      return {
        masterStyle: styles.masterLandscape,
        detailStyle: styles.detailLandscape };
    }
    const masterW = Math.round(windowW * MASTER_PORTRAIT_RATIO);
    return {
      masterStyle: [styles.masterPortrait, { width: masterW, maxWidth: masterW }],
      detailStyle: styles.detailPortrait };
  }, [isPortrait, windowW]);

  const [stack, setStack] = useState([]);

  const clearStack = useCallback(() => {
    setStack([]);
  }, []);

  const clearContactProfile = useCallback(() => {
    setStack((prev) => (prev.some((e) => e.type === 'ContactProfile') ? [] : prev));
  }, []);

  useEffect(() => {
    splitDetailApi.clearStack = clearStack;
    splitDetailApi.clearContactProfile = clearContactProfile;
    return () => {
      splitDetailApi.clearStack = null;
      splitDetailApi.clearContactProfile = null;
    };
  }, [clearStack, clearContactProfile]);

  const setDetailParams = useCallback((entry) => {
    setStack(entry ? [entry] : []);
  }, []);

  const pushDetail = useCallback((entry) => {
    setStack((prev) => [...prev, entry]);
  }, []);

  const popDetail = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
  }, []);

  const currentDetail = stack.length > 0 ? stack[stack.length - 1] : null;

  const prevIsSplitRef = React.useRef(isSplit);
  useEffect(() => {
    if (prevIsSplitRef.current && !isSplit) setStack([]);
    prevIsSplitRef.current = isSplit;
  }, [isSplit]);

  const contextValue = useMemo(
    () => ({ currentDetail, setDetailParams, pushDetail, popDetail }),
    [currentDetail, setDetailParams, pushDetail, popDetail]
  );

  if (!isSplit) {
    return (
      <SplitDetailProvider>
        {children}
      </SplitDetailProvider>
    );
  }

  return (
    <SplitDetailContext.Provider value={contextValue}>
      <View key={layoutKey} style={styles.root}>
        <View style={masterStyle}>
          {children}
        </View>
        <DetailPanel panelStyle={detailStyle} />
      </View>
    </SplitDetailContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: V.bgApp },
  masterPortrait: {
    flexGrow: 0,
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: V.border,
    overflow: 'hidden' },
  masterLandscape: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: V.border,
    overflow: 'hidden' },
  detailLandscape: {
    flex: 2,
    minWidth: 0,
    backgroundColor: V.bgApp,
    overflow: 'hidden' },
  detailPortrait: {
    flex: 1,
    minWidth: 0,
    backgroundColor: V.bgApp,
    overflow: 'hidden' },
  detailCenter: {
    alignItems: 'center',
    justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: V.accentSage },
  placeholder: {
    color: V.textGhost,
    fontSize: 15,
    fontWeight: '400'
  } });
