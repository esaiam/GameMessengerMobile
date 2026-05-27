/**
 * GameIslandShell — Dynamic Island хаб игр.
 *
 * Вся анимация — одна чёрная форма, морфирующая как iOS Dynamic Island:
 *
 *   collapsed    → узкий pill, иконка кубиков
 *   picker       → pill расширяется (ширина + высота), иконки stagger-in
 *   gameExpanded → остров раскрывается до полного размера доски,
 *                  контент фейдится in после раскрытия
 *
 * Ключевая идея: outer Animated.View (width=stripWidthAnim) получает
 *   backgroundColor rgba(0,0,0,0.9), borderColor и borderRadius.
 *   Высота = boardDropAnim (board area) + effectiveHandleH (bottom section).
 *   Единое тело, нет отдельного "выпадающего бара".
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import BackgammonBoard from '../../components/BackgammonBoard';
import DiceThrow3D from '../../components/DiceThrow3D';
import SwipeBoardHint from '../../components/SwipeBoardHint';
import { V } from '../../theme';
import { Dices } from '../../icons/lucideIcons';
import {
  BOARD_SIDE_GAP,
  MIN_PH,
  DRAG_MAX_EXTRA_H,
  THUMB_W_MAX,
  THUMB_W_MIN,
  THUMB_H_LINE,
} from './gameScreenConstants';
import GameBoardDiceCenter from './GameBoardDiceCenter';
import { gameRegistry } from './gameRegistry';
import { ISLAND_COLLAPSED_H } from './useGameIslandAnimation';

// ─── Константы визуала ────────────────────────────────────────────────────────

const ISLAND_ICON_SIZE    = 20;
const PICKER_ICON_SIZE    = 24;
const ISLAND_BORDER_W     = 1;
const ISLAND_BORDER_COLOR = 'rgba(255,255,255,0.26)';
/** 90% непрозрачности — лёгкий просвет чата за островом */
const ISLAND_BG           = 'rgba(0, 0, 0, 0.9)';
const RADIUS_COLLAPSED    = ISLAND_COLLAPSED_H / 2; // pill
const RADIUS_EXPANDED     = 14;                     // скруглённый прямоугольник
const NUB_COLOR           = 'rgba(255,255,255,0.40)';

// ─── Component ───────────────────────────────────────────────────────────────

export default function GameIslandShell({
  // Layout
  boardColRef,
  boardTopOffset,
  boardColTopYRef,
  computeMaxSlide,
  onBoardColLayoutWidth,

  // Animated (strip width и board height из hooks)
  stripWidthAnim,
  boardDropAnim,
  handleWidthAnim,   // для borderRadius-морфинга
  handleStretchAnim, // для stretch-feedback и nub

  // Pan
  slidePan,

  // Состояние монтирования
  boardMounted,
  boardContentActive,
  boardRef,
  renderPausedRef,

  // Game state (нарды)
  effectiveGameState,
  gameState,
  isMyTurn,
  selfPlay,
  opponentOnline,
  playerNumber,
  selectedPoint,
  highlightedMoves,
  onPointPress,
  onBarPress,
  onBearOffPress,
  onSwipe,
  onNewGame,

  // Layout flags
  kbTransitioning,
  isTabletLayout,
  boardMaxW,

  // Кости 3D
  showAnimDice,
  animDice,
  swipeStart,
  swipeEnd,
  boardRenderW,
  pointH,
  onDiceAnimComplete,
  diceGlPausedRef,

  // Board UI
  boardMode,
  gameStarted,
  sandboxUiDice,
  uiDice,
  showFingerHint,
  onSwipeHintComplete,
  canEndTurn,
  onEndTurn,

  // Island FSM
  islandState,
  activeGameId,
  pickerHeightAnim,   // base height нижней секции (COLLAPSED_H ↔ PICKER_H)
  pickerIconAnims,
  boardContentFadeAnim,
  tapGameIcon,
  dismissPicker,
}) {
  const isExpanded = islandState === 'gameExpanded';
  const isPicker   = islandState === 'picker';

  // ── Анимации, вычисляемые локально ────────────────────────────────────────

  /**
   * Высота нижней секции island:
   *   pickerHeightAnim задаёт базу (COLLAPSED_H в collapsed/expanded, PICKER_H в picker),
   *   handleStretchAnim добавляет drag-feedback.
   */
  const effectiveHandleH = useMemo(
    () =>
      Animated.add(
        pickerHeightAnim,
        handleStretchAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, DRAG_MAX_EXTRA_H],
          extrapolate: 'clamp',
        }),
      ),
    [pickerHeightAnim, handleStretchAnim],
  );

  /**
   * borderRadius внешней формы:
   *   handleWidthAnim=0 → RADIUS_COLLAPSED (pill)
   *   handleWidthAnim=1 → RADIUS_EXPANDED  (скруглённый прямоугольник)
   */
  const borderRadiusAnim = useMemo(
    () =>
      handleWidthAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [RADIUS_COLLAPSED, RADIUS_EXPANDED],
        extrapolate: 'clamp',
      }),
    [handleWidthAnim],
  );

  // ── Routing по активной игре ───────────────────────────────────────────────

  const activeEntry  = gameRegistry.find((g) => g.id === activeGameId);
  const ActiveBoard  = activeEntry?.BoardComponent ?? null;
  const isBackgammon = activeGameId === 'backgammon';

  return (
    <View
      ref={boardColRef}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (typeof w === 'number' && w > 0) onBoardColLayoutWidth(w);
        boardColRef.current?.measureInWindow((_x, y) => {
          if (typeof y === 'number') {
            boardColTopYRef.current = y;
            computeMaxSlide();
          }
        });
      }}
      pointerEvents="box-none"
      style={[styles.container, { top: boardTopOffset }]}
    >
      {/* ── Единая форма Island ────────────────────────────────────────────
          width: stripWidthAnim (pill → medium → full)
          borderRadius: морфирует pill → rounded-rect
          Высота определяется суммой boardDropAnim + effectiveHandleH.       */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.islandOuter,
          {
            width: stripWidthAnim,
            borderRadius: borderRadiusAnim,
          },
        ]}
      >
        {/* ── Board area (height: 0 в collapsed/picker, maxH в expanded) ── */}
        <Animated.View
          style={{ height: boardDropAnim, overflow: 'hidden' }}
          pointerEvents="box-none"
        >
          {boardMounted && boardContentActive && ActiveBoard && (
            <Animated.View
              style={[styles.boardInner, { opacity: boardContentFadeAnim }]}
            >
              {isBackgammon ? (
                <BackgammonBoard
                  ref={boardRef}
                  renderPausedRef={renderPausedRef}
                  gameState={effectiveGameState}
                  isMyTurn={isMyTurn}
                  turnPhase={gameState.turnPhase}
                  selfPlay={selfPlay}
                  opponentOnline={opponentOnline}
                  playerNumber={playerNumber}
                  selectedPoint={selectedPoint}
                  highlightedMoves={highlightedMoves}
                  onPointPress={onPointPress}
                  onBarPress={onBarPress}
                  onBearOffPress={onBearOffPress}
                  onSwipe={onSwipe}
                  topBarMiddle={
                    <TouchableOpacity
                      onPress={onNewGame}
                      disabled={!selfPlay && !opponentOnline}
                      style={[
                        styles.newGameBtn,
                        !selfPlay && !opponentOnline && styles.disabledBtn,
                      ]}
                    >
                      <Text style={styles.btnText}>Новая игра</Text>
                    </TouchableOpacity>
                  }
                  enableLayoutAnimations={!kbTransitioning && !isTabletLayout}
                  maxBoardWidth={boardMaxW}
                  diceOverlay={
                    showAnimDice && (
                      <DiceThrow3D
                        dice={animDice}
                        startPos={swipeStart}
                        endPos={swipeEnd}
                        boardWidth={boardRenderW}
                        boardHeight={pointH * 2}
                        onComplete={onDiceAnimComplete}
                        pausedRef={diceGlPausedRef}
                      />
                    )
                  }
                  centerOverlay={
                    !showAnimDice && (
                      <GameBoardDiceCenter
                        boardMode={boardMode}
                        gameStarted={gameStarted}
                        gameState={gameState}
                        sandboxUiDice={sandboxUiDice}
                        uiDice={uiDice}
                      />
                    )
                  }
                  swipeHintOverlay={
                    <SwipeBoardHint
                      visible={showFingerHint}
                      boardWidth={boardRenderW}
                      boardHeight={pointH * 2}
                      onComplete={onSwipeHintComplete}
                    />
                  }
                  pointHeight={pointH}
                  pointHeightMin={MIN_PH}
                  pointHeightMax={pointH}
                >
                  {canEndTurn && (
                    <View style={styles.endTurnRow}>
                      <TouchableOpacity style={styles.endTurnBtn} onPress={onEndTurn}>
                        <Text style={styles.btnText}>Завершить ход</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </BackgammonBoard>
              ) : (
                <ActiveBoard />
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Нижняя секция island (tap/drag target + контент состояния) ── */}
        <Animated.View
          {...slidePan.panHandlers}
          style={[styles.islandBottom, { height: effectiveHandleH }]}
          accessibilityRole="button"
          accessibilityLabel={
            isExpanded ? 'Потяни вверх, чтобы закрыть доску'
            : isPicker  ? 'Выбери игру'
            : 'Нажми, чтобы открыть игры'
          }
        >
          {/* collapsed: иконка кубиков */}
          {!isExpanded && !isPicker && (
            <View pointerEvents="none" style={styles.centeredContent}>
              <Dices
                size={ISLAND_ICON_SIZE}
                color="rgba(255,255,255,0.80)"
                strokeWidth={1.5}
              />
            </View>
          )}

          {/* picker: иконки игр со scale+opacity анимацией (без подписей) */}
          {isPicker && (
            <View style={styles.pickerContent}>
              <View style={styles.pickerRow}>
                {gameRegistry.map((entry, i) => (
                  <Animated.View
                    key={entry.id}
                    style={{
                      transform: [{ scale: pickerIconAnims[i].scale }],
                      opacity: pickerIconAnims[i].opacity,
                    }}
                  >
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => tapGameIcon(entry.id)}
                      activeOpacity={0.6}
                    >
                      <entry.Icon
                        size={PICKER_ICON_SIZE}
                        color="rgba(255,255,255,0.85)"
                        strokeWidth={1.5}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}

          {/* gameExpanded: drag nub (белая полоска) */}
          {isExpanded && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.nubBase,
                {
                  width: handleStretchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [THUMB_W_MAX, THUMB_W_MIN],
                    extrapolate: 'clamp',
                  }),
                  height: handleStretchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [THUMB_H_LINE, THUMB_W_MIN],
                    extrapolate: 'clamp',
                  }),
                  borderRadius: handleStretchAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [9999, THUMB_W_MIN / 2],
                    extrapolate: 'clamp',
                  }),
                  backgroundColor: NUB_COLOR,
                },
              ]}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },

  // Единая форма острова
  islandOuter: {
    alignSelf: 'center',
    backgroundColor: ISLAND_BG,
    borderWidth: ISLAND_BORDER_W,
    borderColor: ISLAND_BORDER_COLOR,
    overflow: 'hidden',
  },

  boardInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: BOARD_SIDE_GAP,
  },

  // Нижняя секция (содержит collapsed/picker/expanded контент)
  islandBottom: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  centeredContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Picker
  pickerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  pickerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.13)',
  },

  // Drag nub
  nubBase: {
    // backgroundColor задаётся inline (NUB_COLOR) через Animated
  },

  // Board buttons
  newGameBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: V.bgElevated,
    borderWidth: 0.5,
    borderColor: V.border,
  },
  disabledBtn: { opacity: 0.45 },
  btnText: { fontSize: 10, fontWeight: '500', color: V.textSecondary },
  endTurnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  endTurnBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: V.bgElevated,
    borderWidth: 0.5,
    borderColor: V.border,
  },
});
