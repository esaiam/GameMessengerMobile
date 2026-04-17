import React, { useMemo, useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  LayoutAnimation,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import SafeBlurView from './SafeBlurView';
import tw from 'twrnc';
import { V, boardPalette } from '../theme';

/** Тинт поверх blur — как у GlassTabBar, из токена bgElevated */
const GLASS_TINT = 'rgba(37, 42, 53, 0.4)';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Сколько фишек можно показать в стопке: при max высоте ползунка — 15, при min — 1. */
function maxVisibleForPointHeight(pointHeight, minH, maxH) {
  if (maxH <= minH) return 15;
  const t = Math.max(0, Math.min(1, (pointHeight - minH) / (maxH - minH)));
  return Math.max(1, Math.round(1 + t * 14));
}

const COLORS = {
  darkTriangle: boardPalette.triangleDark,
  lightTriangle: boardPalette.triangleLight,
  player1: boardPalette.checkerLight,
  player1Border: boardPalette.checkerLightBorder,
  player2: boardPalette.checkerDark,
  player2Border: boardPalette.checkerDarkBorder,
  highlight: V.accentGold,
  selected: V.accentSage,
  barBg: boardPalette.bar,
};

function Checker({ player, size, isSelected }) {
  const bg = player === 1 ? COLORS.player1 : COLORS.player2;
  const border = player === 1 ? COLORS.player1Border : COLORS.player2Border;
  return (
    <View
      style={[
        tw`rounded-full items-center justify-center`,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderWidth: 2,
          borderColor: isSelected ? COLORS.selected : border,
        },
      ]}
    >
      {isSelected && (
        <View
          style={{
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: COLORS.selected,
          }}
        />
      )}
    </View>
  );
}

function Triangle({
  index,
  isTop,
  color,
  checkers,
  player,
  isHighlighted,
  isSelected,
  onPress,
  pointHeight,
  maxDisplay,
  pointWidth,
  checkerSize,
}) {
  const count = Math.abs(checkers);
  const cap = Math.max(1, maxDisplay);
  const show = Math.min(count, cap);
  const extra = count > show ? count - show : 0;
  const stackOverlap = Math.round(clamp(checkerSize * 0.18, 3, 10));

  // Use stable render keys (0..show-1) so removal doesn't "lag" due to shifting keys,
  // especially noticeable on tablets when count changes frequently.
  const startIndex = isTop ? 0 : Math.max(0, count - show);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          width: pointWidth,
          height: pointHeight,
          alignItems: 'center',
          justifyContent: isTop ? 'flex-start' : 'flex-end',
        },
        isHighlighted && { backgroundColor: 'rgba(90, 158, 154, 0.22)', borderRadius: 4 },
      ]}
    >
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: Math.max(0, pointWidth / 2 - 1),
          borderRightWidth: Math.max(0, pointWidth / 2 - 1),
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          ...(isTop
            ? { borderTopWidth: pointHeight * 0.8, borderTopColor: color }
            : { borderBottomWidth: pointHeight * 0.8, borderBottomColor: color }),
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
        }}
      />

      <View
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 2,
          alignItems: 'center',
        }}
      >
        {Array.from({ length: show }).map((_, pos) => {
          const stackIdx = startIndex + pos;
          const isStackSelected = isSelected && stackIdx === count - 1;
          return (
          <View
            key={pos}
            style={{ marginBottom: isTop ? -stackOverlap : 0, marginTop: !isTop ? -stackOverlap : 0 }}
          >
            <Checker
              player={player}
              size={checkerSize}
              isSelected={isStackSelected}
            />
          </View>
        )})}
        {extra > 0 && (
          <Text style={[tw`text-[10px] font-medium mt-0.5`, { color: V.textPrimary }]}>+{extra}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Роза ветров из PNG (подложка подогнана под bg доски, см. scripts/tint-compass-to-board.mjs) */
function PrisonCompassStarImage({ size }) {
  return (
    <Image
      source={require('../../assets/compass-star.png')}
      style={{
        width: size,
        height: size,
        opacity: 0.98,
        backgroundColor: 'transparent',
      }}
      resizeMode="contain"
    />
  );
}

const BackgammonBoard = forwardRef(function BackgammonBoard({
  gameState,
  playerNumber,
  selectedPoint,
  highlightedMoves,
  onPointPress,
  onBarPress,
  onBearOffPress,
  onSwipe,
  diceOverlay,
  centerOverlay,
  swipeHintOverlay,
  topBarMiddle,
  pointHeight = 130,
  pointHeightMin = 50,
  pointHeightMax = 260,
  enableLayoutAnimations = true,
  maxBoardWidth,
  renderPausedRef,
  children,
}, ref) {
  useImperativeHandle(ref, () => ({
    pauseRendering() { if (renderPausedRef) renderPausedRef.current = true; },
    resumeRendering() { if (renderPausedRef) renderPausedRef.current = false; },
  }), [renderPausedRef]);

  const { board, bar = { 1: 0, 2: 0 }, borneOff } = gameState;

  const [containerW, setContainerW] = useState(0);
  const layoutBoardW = useMemo(() => {
    const w = containerW > 0 ? containerW : 0;
    if (!w) return 0;
    const cap = typeof maxBoardWidth === 'number' && maxBoardWidth > 0 ? maxBoardWidth : w;
    return Math.floor(Math.min(w, cap));
  }, [containerW, maxBoardWidth]);

  const { barW, pointW, checkerSize } = useMemo(() => {
    const bw = layoutBoardW || 0;
    if (!bw) return { barW: 24, pointW: 0, checkerSize: 0 };
    // Scale the bar slightly on larger boards, but keep geometry stable.
    const nextBarW = Math.round(clamp(bw * 0.048, 24, 40));
    const nextPointW = (bw - nextBarW) / 12;
    // Remove the old 32px ceiling; keep a mild safety cap to avoid comically large checkers on huge screens.
    const nextChecker = Math.floor(clamp(nextPointW - 2, 18, 64));
    return { barW: nextBarW, pointW: nextPointW, checkerSize: nextChecker };
  }, [layoutBoardW]);

  const maxVisible = maxVisibleForPointHeight(pointHeight, pointHeightMin, pointHeightMax);
  const prevMaxVisibleRef = useRef(maxVisible);
  const prevPointHeightRef = useRef(pointHeight);

  useEffect(() => {
    if (!enableLayoutAnimations) {
      prevMaxVisibleRef.current = maxVisible;
      prevPointHeightRef.current = pointHeight;
      return;
    }
    // Animate only when the user actually resizes the point height.
    // On tablets, pointHeightMax can change on layout/orientation, which changes maxVisible and
    // would otherwise cause "delayed" checker removal during normal moves.
    const pointHeightChanged = prevPointHeightRef.current !== pointHeight;
    if (pointHeightChanged && prevMaxVisibleRef.current !== maxVisible) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
      );
    }
    prevMaxVisibleRef.current = maxVisible;
    prevPointHeightRef.current = pointHeight;
  }, [maxVisible, pointHeight, enableLayoutAnimations]);
  const highlightedTargets = (highlightedMoves || []).map((m) => m.to);
  const offHighlight = highlightedTargets.includes('off');
  const halfW = pointW * 6;
  const right12Start = halfW + barW;
  const leftClusterCx = halfW / 2;
  const rightClusterCx = right12Start + halfW / 2;
  const starSize = Math.round(
    Math.min(64, Math.max(36, Math.min(pointHeight * 0.5, (pointHeight * 2) * 0.28)))
  );

  const boardAreaRef = useRef(null);
  const boardPos = useRef({ x: 0, y: 0 });
  const onSwipeRef = useRef(onSwipe);
  useEffect(() => { onSwipeRef.current = onSwipe; }, [onSwipe]);

  const swipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !!onSwipeRef.current && (Math.abs(gs.dx) > 20 || Math.abs(gs.dy) > 20),
      onPanResponderRelease: (evt, gs) => {
        if (!onSwipeRef.current) return;
        const dist = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);
        if (dist < 30) return;
        const ex = evt.nativeEvent.pageX - boardPos.current.x;
        const ey = evt.nativeEvent.pageY - boardPos.current.y;
        onSwipeRef.current({
          startX: ex - gs.dx, startY: ey - gs.dy,
          endX: ex, endY: ey,
          vx: gs.vx, vy: gs.vy,
        });
      },
    })
  ).current;

  const topIndices = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const bottomIndices = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  const renderHalf = (indices, isTop) => {
    const leftHalf = indices.slice(0, 6);
    const rightHalf = indices.slice(6, 12);

    return (
      <View style={{ position: 'relative', width: layoutBoardW, height: pointHeight }}>
        <View style={tw`flex-row`}>
          {leftHalf.map((idx) => {
            const val = board[idx];
            const player = val > 0 ? 1 : val < 0 ? 2 : 0;
            const color = idx % 2 === 0 ? COLORS.darkTriangle : COLORS.lightTriangle;
            return (
              <Triangle
                key={idx}
                index={idx}
                isTop={isTop}
                color={color}
                checkers={val}
                player={player}
                isHighlighted={highlightedTargets.includes(idx)}
                isSelected={selectedPoint === idx}
                onPress={() => onPointPress(idx)}
                pointHeight={pointHeight}
                maxDisplay={maxVisible}
                pointWidth={pointW}
                checkerSize={checkerSize}
              />
            );
          })}

          <TouchableOpacity
            onPress={() => onBarPress(isTop ? 2 : 1)}
            style={{
              width: barW,
              height: pointHeight,
              backgroundColor: COLORS.barBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
            }}
          >
            {(isTop ? bar[2] : bar[1]) > 0 && (
              <View style={tw`items-center`}>
                <Checker player={isTop ? 2 : 1} size={Math.max(16, checkerSize - 4)} isSelected={selectedPoint === 'bar'} />
                {(isTop ? bar[2] : bar[1]) > 1 && (
                  <Text style={[tw`text-[10px] font-medium mt-1`, { color: V.textPrimary }]}>
                    {isTop ? bar[2] : bar[1]}
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          {rightHalf.map((idx) => {
            const val = board[idx];
            const player = val > 0 ? 1 : val < 0 ? 2 : 0;
            const color = idx % 2 === 0 ? COLORS.darkTriangle : COLORS.lightTriangle;
            return (
              <Triangle
                key={idx}
                index={idx}
                isTop={isTop}
                color={color}
                checkers={val}
                player={player}
                isHighlighted={highlightedTargets.includes(idx)}
                isSelected={selectedPoint === idx}
                onPress={() => onPointPress(idx)}
                pointHeight={pointHeight}
                maxDisplay={maxVisible}
                pointWidth={pointW}
                checkerSize={checkerSize}
              />
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (typeof w === 'number' && w > 0) setContainerW(w);
      }}
      style={{
        backgroundColor: boardPalette.bg,
        width: '100%',
        alignSelf: 'stretch',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: layoutBoardW || '100%',
          maxWidth: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: boardPalette.bg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: V.border,
        }}
      >
        <SafeBlurView
          intensity={Platform.OS === 'ios' ? 52 : 40}
          tint="dark"
          blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
          style={{ width: '100%' }}
        >
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_TINT }]} />
          {/* Верхний блик «стекла» — тонкая линия, без градиента */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 12,
              right: 12,
              height: StyleSheet.hairlineWidth,
              backgroundColor: V.sectionBorder,
              zIndex: 3,
            }}
          />
      <View style={{ width: '100%' }}>
      <View style={tw`flex-row items-center justify-between px-2 py-1`}>
        <View style={tw`flex-row items-center`}>
          <TouchableOpacity
            onPress={() => onBearOffPress(2)}
            style={[
              tw`flex-row items-center`,
              offHighlight && playerNumber === 2 && { backgroundColor: 'rgba(90,158,154,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
            ]}
          >
            <Checker player={2} size={16} />
            <Text style={[tw`text-[10px] font-medium ml-1`, { color: V.textPrimary }]}>{borneOff[2]}/15</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-row items-center`}>
          {topBarMiddle || null}
        </View>

        <View style={tw`flex-row items-center justify-end`}>
          <TouchableOpacity
            onPress={() => onBearOffPress(1)}
            style={[
              tw`flex-row items-center`,
              offHighlight && playerNumber === 1 && { backgroundColor: 'rgba(90,158,154,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
            ]}
          >
            <Text style={[tw`text-[10px] font-medium mr-1`, { color: V.textPrimary }]}>{borneOff[1]}/15</Text>
            <Checker player={1} size={16} />
          </TouchableOpacity>
        </View>
      </View>

      <View
        ref={boardAreaRef}
        onLayout={() => {
          boardAreaRef.current?.measureInWindow((x, y) => {
            boardPos.current = { x, y };
          });
        }}
        {...swipePan.panHandlers}
        style={{ position: 'relative', width: layoutBoardW || '100%' }}
      >
        {!!layoutBoardW && pointW > 0 && checkerSize > 0 && (
          <>
            {renderHalf(topIndices, true)}
            {renderHalf(bottomIndices, false)}
          </>
        )}
        {/* Вертикальная граница между двумя половинами поля (по центру бара) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: halfW + barW / 2 - 1,
            top: 0,
            width: 2,
            height: pointHeight * 2,
            backgroundColor: boardPalette.divider,
            zIndex: 1,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: leftClusterCx - starSize / 2,
            top: pointHeight - starSize / 2,
            width: starSize,
            height: starSize,
            zIndex: 2,
          }}
        >
          <PrisonCompassStarImage size={starSize} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: rightClusterCx - starSize / 2,
            top: pointHeight - starSize / 2,
            width: starSize,
            height: starSize,
            zIndex: 2,
          }}
        >
          <PrisonCompassStarImage size={starSize} />
        </View>
        {!!centerOverlay && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              elevation: 10,
            }}
          >
            {centerOverlay}
          </View>
        )}
        {!!diceOverlay && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              elevation: 50,
            }}
          >
            {diceOverlay}
          </View>
        )}
        {swipeHintOverlay}
      </View>

      {children}
      </View>
        </SafeBlurView>
      </View>
    </View>
  );
});

export default BackgammonBoard;
