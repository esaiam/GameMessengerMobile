/**
 * gameRegistry — реестр игр для GameIsland.
 *
 * Добавление новой игры:
 *   1. Создать BoardComponent (или PlaceholderBoard пока не готово)
 *   2. Добавить запись сюда
 *   3. Если нужна специфичная высота — переопределить computeLayout
 *   FSM, picker, анимации подхватываются автоматически.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BackgammonBoard from '../../components/BackgammonBoard';
import { Dices, Circle, Crown } from '../../icons/lucideIcons';
import { V } from '../../theme';
import { MIN_PH, DEFAULT_PH, BOARD_CHROME } from './gameScreenConstants';

// ─── Placeholder для ещё не реализованных игр ────────────────────────────────

const makePlaceholder = (title) =>
  function PlaceholderBoard() {
    return (
      <View style={ph.container}>
        <Text style={ph.text}>{title} — скоро</Text>
      </View>
    );
  };

const ph = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { color: V.textMuted, fontSize: 14, fontWeight: '500' },
});

// ─── Registry ────────────────────────────────────────────────────────────────

/** @type {GameRegistryEntry[]} */
export const gameRegistry = [
  {
    id: 'backgammon',
    title: 'Нарды',
    Icon: Dices,
    BoardComponent: BackgammonBoard,
    computeLayout({ availableH }) {
      const ph = availableH > 0
        ? Math.max(MIN_PH, Math.floor((availableH - BOARD_CHROME) / 2))
        : DEFAULT_PH;
      return { pointH: ph, boardH: availableH };
    },
  },
  {
    id: 'go',
    title: 'Го',
    Icon: Circle,
    BoardComponent: makePlaceholder('Го'),
    computeLayout({ availableH }) {
      // Доска Го — квадрат; используем меньшую сторону
      return { pointH: availableH, boardH: availableH };
    },
  },
  {
    id: 'chess',
    title: 'Шахматы',
    Icon: Crown,
    BoardComponent: makePlaceholder('Шахматы'),
    computeLayout({ availableH }) {
      return { pointH: availableH, boardH: availableH };
    },
  },
];

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   Icon: import('react').ComponentType<any>,
 *   BoardComponent: import('react').ComponentType<any>,
 *   computeLayout: (params: { availableH: number, windowW: number }) => { pointH: number, boardH: number },
 * }} GameRegistryEntry
 */
