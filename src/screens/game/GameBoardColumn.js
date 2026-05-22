import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  StyleSheet,
} from 'react-native';
import tw from 'twrnc';
import SafeBlurView from '../../components/SafeBlurView';
import BackgammonBoard from '../../components/BackgammonBoard';
import DiceThrow3D from '../../components/DiceThrow3D';
import SwipeBoardHint from '../../components/SwipeBoardHint';
import { V } from '../../theme';
import {
  HANDLE_BLUR_INTENSITY_IOS,
  HANDLE_BLUR_INTENSITY_ANDROID,
  HANDLE_FROST_TINT_OPACITY,
  BOARD_SIDE_GAP,
  MIN_PH,
  THUMB_W_MAX,
  THUMB_W_MIN,
  THUMB_H_LINE,
} from './gameScreenConstants';
import GameBoardDiceCenter from './GameBoardDiceCenter';

export default function GameBoardColumn({
  boardColRef,
  boardTopOffset,
  boardColTopYRef,
  computeMaxSlide,
  onBoardColLayoutWidth,
  stripWidthAnim,
  boardDropAnim,
  slidePan,
  boardMounted,
  boardContentActive,
  boardRef,
  renderPausedRef,
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
  kbTransitioning,
  isTabletLayout,
  boardMaxW,
  showAnimDice,
  throwKey,
  animDice,
  swipeStart,
  swipeEnd,
  boardRenderW,
  pointH,
  onDiceAnimComplete,
  diceGlPausedRef,
  boardMode,
  gameStarted,
  sandboxUiDice,
  uiDice,
  showFingerHint,
  onSwipeHintComplete,
  canEndTurn,
  onEndTurn,
  animatedHandleH,
  bottomR,
  handleStretchAnim,
}) {
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
      style={{
        position: 'absolute',
        top: boardTopOffset,
        left: 0,
        right: 0,
        zIndex: 10,
        elevation: 10,
      }}
    >
      <Animated.View
        pointerEvents="box-none"
        style={{
          width: stripWidthAnim,
          alignSelf: 'center',
        }}
      >
        <Animated.View style={{ height: boardDropAnim, overflow: 'hidden' }} pointerEvents="box-none">
          {boardMounted && boardContentActive && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                paddingHorizontal: BOARD_SIDE_GAP,
              }}
            >
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
                      tw`px-3 py-1.5 rounded-[10px]`,
                      { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border },
                      !selfPlay && !opponentOnline && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={[tw`text-[10px] font-medium`, { color: V.textSecondary }]}>
                      Новая игра
                    </Text>
                  </TouchableOpacity>
                }
                enableLayoutAnimations={!kbTransitioning && !isTabletLayout}
                maxBoardWidth={boardMaxW}
                diceOverlay={
                  showAnimDice && (
                    <DiceThrow3D
                      key={throwKey}
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
                  <View style={tw`flex-row items-center justify-center`}>
                    <TouchableOpacity
                      style={[
                        tw`rounded-[10px] px-4 py-2`,
                        { backgroundColor: V.bgElevated, borderWidth: 0.5, borderColor: V.border },
                      ]}
                      onPress={onEndTurn}
                    >
                      <Text style={[tw`text-[10px] font-medium`, { color: V.textSecondary }]}>
                        Завершить ход
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </BackgammonBoard>
            </View>
          )}
        </Animated.View>

        <Animated.View
          {...slidePan.panHandlers}
          style={[
            tw`items-center justify-center`,
            {
              height: animatedHandleH,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: V.border,
              borderTopLeftRadius: bottomR,
              borderTopRightRadius: bottomR,
              borderBottomLeftRadius: bottomR,
              borderBottomRightRadius: bottomR,
            },
          ]}
          accessibilityLabel="Потяни вниз, чтобы открыть доску"
        >
          <SafeBlurView
            intensity={Platform.OS === 'ios' ? HANDLE_BLUR_INTENSITY_IOS : HANDLE_BLUR_INTENSITY_ANDROID}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: V.bgElevated, opacity: HANDLE_FROST_TINT_OPACITY },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={{
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
              overflow: 'hidden',
            }}
          >
            <SafeBlurView
              intensity={Platform.OS === 'ios' ? 18 : 14}
              tint="dark"
              blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
              pointerEvents="none"
              style={StyleSheet.absoluteFillObject}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: V.textPrimary, opacity: 0.22 },
              ]}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
