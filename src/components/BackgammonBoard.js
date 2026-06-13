import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
  useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  TouchableOpacity,
  LayoutAnimation,
  Image,
  StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import { V, boardPalette } from '../theme';

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
  highlight: V.accentGold,
  selected: V.accentSage,
  barBg: boardPalette.bar };

/** Матовая фишка: мягкий градиент и диффузный свет без зеркальных бликов. */
const CHECKER_MATERIAL = {
  light: {
    gradient: ['#EBE7DE', boardPalette.checkerLight, '#D8D4CC'],
    diffuseLight: 'rgba(255, 255, 255, 0.09)',
    innerShadow: 'rgba(100, 92, 82, 0.14)',
    rim: boardPalette.checkerLightBorder,
    castShadowOpacity: 0.16 },
  dark: {
    gradient: ['#242933', boardPalette.checkerDark, '#151922'],
    diffuseLight: 'rgba(255, 255, 255, 0.03)',
    innerShadow: 'rgba(0, 0, 0, 0.28)',
    rim: boardPalette.checkerDarkBorder,
    castShadowOpacity: 0.24 } };

const Checker = memo(function Checker({ player, size, isSelected }) {
  const material = player === 1 ? CHECKER_MATERIAL.light : CHECKER_MATERIAL.dark;
  const radius = size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: Math.max(1, size * 0.07) },
        shadowOpacity: material.castShadowOpacity,
        shadowRadius: Math.max(2, size * 0.08),
        elevation: 3 }}
    >
      <LinearGradient
        colors={material.gradient}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0.05 }}
        end={{ x: 0.5, y: 0.98 }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 2,
          borderColor: isSelected ? COLORS.selected : material.rim,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden' }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: size * 0.56,
            borderTopLeftRadius: radius - 2,
            borderTopRightRadius: radius - 2,
            backgroundColor: material.diffuseLight }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: size * 0.38,
            borderBottomLeftRadius: radius - 2,
            borderBottomRightRadius: radius - 2,
            backgroundColor: material.innerShadow }}
        />
        {isSelected && (
          <View
            style={{
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              backgroundColor: COLORS.selected,
              shadowColor: COLORS.selected,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 4,
              elevation: 2 }}
          />
        )}
      </LinearGradient>
    </View>
  );
});

// Коэффициенты высоты треугольника для дуги окружности.
// 6 позиций: от внешнего края (0) к центральному бару (5).
// cos(i * π/14) даёт плавную дугу ~65°: [1.0, 0.975, 0.901, 0.781, 0.625, 0.433]
const TRIANGLE_ARC = Array.from({ length: 6 }, (_, i) => Math.cos(i * Math.PI / 14));

const TriangleShape = memo(function TriangleShape({
  isTop,
  color,
  pointHeight,
  triangleH,
  pointWidth,
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        width: pointWidth,
        height: pointHeight,
        alignItems: 'center',
        justifyContent: isTop ? 'flex-start' : 'flex-end' }}
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
            ? { borderTopWidth: triangleH ?? pointHeight * 0.8, borderTopColor: color }
            : { borderBottomWidth: triangleH ?? pointHeight * 0.8, borderBottomColor: color }),
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0 }}
      />
    </View>
  );
});

const PointCell = memo(function PointCell({
  index,
  isTop,
  checkers,
  player,
  isHighlighted,
  isSelected,
  onPointPress,
  pointHeight,
  maxDisplay,
  pointWidth,
  checkerSize,
}) {
  const handlePointPress = useCallback(() => {
    onPointPress(index);
  }, [onPointPress, index]);

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
      onPress={handlePointPress}
      activeOpacity={0.7}
      style={[
        {
          width: pointWidth,
          height: pointHeight,
          alignItems: 'center',
          justifyContent: isTop ? 'flex-start' : 'flex-end' },
        isHighlighted && { backgroundColor: 'rgba(90, 158, 154, 0.22)', borderRadius: 4 }]}
    >
      <View
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 2,
          alignItems: 'center' }}
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
});
/** Роза ветров из PNG (подложка подогнана под bg доски, см. scripts/tint-compass-to-board.mjs) */
function PrisonCompassStarImage({ size }) {
  return (
    <Image
      source={require('../../assets/compass-star.png')}
      style={{
        width: size,
        height: size,
        opacity: 0.98,
        backgroundColor: 'transparent' }}
      resizeMode="contain"
    />
  );
}

const BoardOverlayHint = React.memo(function BoardOverlayHint({
  isMyTurn,
  turnPhase,
  selfPlay,
  opponentOnline }) {
  const hint =
    isMyTurn === true && turnPhase === 'roll'
      ? !selfPlay && opponentOnline
        ? 'Бросай!'
        : null
      : isMyTurn === true && turnPhase === 'move' && opponentOnline
        ? 'Ходи!'
        : null;

  const [hintLabel, setHintLabel] = useState(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const previousHintRef = useRef(null);
  const showHintRef = useRef(false);
  const pulseLoopRef = useRef(null);

  useEffect(() => {
    const prevHint = previousHintRef.current;

    const startPulseLoop = () => {
      pulseLoopRef.current?.stop();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.26,
            duration: 900,
            useNativeDriver: true }),
          Animated.timing(opacityAnim, {
            toValue: 0.14,
            duration: 900,
            useNativeDriver: true })])
      );
      pulseLoopRef.current = loop;
      loop.start();
    };

    if (hint) {
      showHintRef.current = true;
      setHintLabel(hint);
      if (prevHint === null) {
        pulseLoopRef.current?.stop();
        pulseLoopRef.current = null;
        opacityAnim.stopAnimation();
        opacityAnim.setValue(0);
        Animated.timing(opacityAnim, {
          toValue: 0.2,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true }).start(({ finished }) => {
          if (!finished || !showHintRef.current) return;
          startPulseLoop();
        });
      }
    } else if (prevHint !== null) {
      showHintRef.current = false;
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      opacityAnim.stopAnimation();
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true }).start(({ finished }) => {
        if (finished) setHintLabel(null);
      });
    }

    previousHintRef.current = hint;
  }, [hint, opacityAnim]);

  useEffect(() => () => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;
    opacityAnim.stopAnimation();
  }, [opacityAnim]);

  if (hintLabel == null) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 6,
        elevation: 6,
        justifyContent: 'center',
        alignItems: 'center' }}
    >
      <Animated.Text
        style={{
          fontSize: 56,
          fontWeight: 'bold',
          color: '#ffffff',
          opacity: opacityAnim,
          textAlign: 'center' }}
      >
        {hintLabel}
      </Animated.Text>
    </View>
  );
});

const BackgammonBoard = memo(forwardRef(function BackgammonBoard({
  gameState,
  playerNumber,
  selectedPoint,
  highlightedMoves,
  onPointPress,
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
  layoutWidthHint,
  onLayoutReady,
  renderPausedRef,
  isMyTurn,
  turnPhase,
  selfPlay = true,
  opponentOnline = false,
  children }, ref) {
  useImperativeHandle(ref, () => ({
    pauseRendering() { if (renderPausedRef) renderPausedRef.current = true; },
    resumeRendering() { if (renderPausedRef) renderPausedRef.current = false; } }), [renderPausedRef]);

  const { board, bar = { 1: 0, 2: 0 }, borneOff } = gameState;

  const [containerW, setContainerW] = useState(0);
  const layoutReadySentRef = useRef(false);
  const layoutBoardW = useMemo(() => {
    const hint = typeof layoutWidthHint === 'number' && layoutWidthHint > 0 ? layoutWidthHint : 0;
    const measured = containerW > 0 ? containerW : 0;
    const seed = hint || measured
      || (typeof maxBoardWidth === 'number' && maxBoardWidth > 0 ? maxBoardWidth : 0);
    if (!seed) return 0;
    const cap = typeof maxBoardWidth === 'number' && maxBoardWidth > 0 ? maxBoardWidth : seed;
    return Math.floor(Math.min(seed, cap));
  }, [containerW, maxBoardWidth, layoutWidthHint]);

  useEffect(() => {
    if (layoutReadySentRef.current) return;
    if (layoutBoardW > 0 && pointHeight > 0) {
      layoutReadySentRef.current = true;
      onLayoutReady?.();
    }
  }, [layoutBoardW, pointHeight, onLayoutReady]);

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

  const highlightedTargets = useMemo(
    () => new Set((highlightedMoves || []).map((m) => m.to)),
    [highlightedMoves]
  );
  const offHighlight = highlightedTargets.has('off');

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

  const emitBoardSwipe = useCallback((absoluteX, absoluteY, translationX, translationY) => {
    if (!onSwipeRef.current) return;
    const dist = Math.hypot(translationX, translationY);
    if (dist < 28) return;
    const { x: bx, y: by } = boardPos.current;
    onSwipeRef.current({
      startX: absoluteX - translationX - bx,
      startY: absoluteY - translationY - by,
      endX: absoluteX - bx,
      endY: absoluteY - by,
      vx: 0,
      vy: 0,
    });
  }, []);

  const boardSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(28)
        .onEnd((e) => {
          runOnJS(emitBoardSwipe)(e.absoluteX, e.absoluteY, e.translationX, e.translationY);
        }),
    [emitBoardSwipe],
  );

  const topIndices = useMemo(() => [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], []);
  const bottomIndices = useMemo(() => [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], []);

  const renderHalf = (indices, isTop) => {
    const leftHalf = indices.slice(0, 6);
    const rightHalf = indices.slice(6, 12);

    const renderTriangleRow = (half, arcFn) =>
      half.map((idx, sliceIdx) => {
        const color = idx % 2 === 0 ? COLORS.darkTriangle : COLORS.lightTriangle;
        return (
          <TriangleShape
            key={`tri-${idx}`}
            isTop={isTop}
            color={color}
            pointHeight={pointHeight}
            triangleH={pointHeight * 0.8 * arcFn(sliceIdx)}
            pointWidth={pointW}
          />
        );
      });

    const renderPointRow = (half) =>
      half.map((idx) => {
        const val = board[idx];
        const player = val > 0 ? 1 : val < 0 ? 2 : 0;
        return (
          <PointCell
            key={idx}
            index={idx}
            isTop={isTop}
            checkers={val}
            player={player}
            isHighlighted={highlightedTargets.has(idx)}
            isSelected={selectedPoint === idx}
            onPointPress={onPointPress}
            pointHeight={pointHeight}
            maxDisplay={maxVisible}
            pointWidth={pointW}
            checkerSize={checkerSize}
          />
        );
      });

    return (
      <View style={{ position: 'relative', width: layoutBoardW, height: pointHeight }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            flexDirection: 'row',
            zIndex: 0,
            elevation: 0 }}
        >
          {renderTriangleRow(leftHalf, (sliceIdx) => TRIANGLE_ARC[sliceIdx])}
          <View style={{ width: barW, height: pointHeight }} />
          {renderTriangleRow(rightHalf, (sliceIdx) => TRIANGLE_ARC[5 - sliceIdx])}
        </View>

        <View style={[tw`flex-row`, { zIndex: 1, elevation: 1 }]}>
          {renderPointRow(leftHalf)}

          <View
            pointerEvents="none"
            style={{
              width: barW,
              height: pointHeight,
              backgroundColor: COLORS.barBg,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4 }}
          >
            {(isTop ? bar[2] : bar[1]) > 0 && (
              <View style={tw`items-center`}>
                <Checker player={isTop ? 2 : 1} size={Math.max(16, checkerSize - 4)} />
                {(isTop ? bar[2] : bar[1]) > 1 && (
                  <Text style={[tw`text-[10px] font-medium mt-1`, { color: V.textPrimary }]}>
                    {isTop ? bar[2] : bar[1]}
                  </Text>
                )}
              </View>
            )}
          </View>

          {renderPointRow(rightHalf)}
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
        backgroundColor: 'transparent',
        width: '100%',
        alignSelf: 'stretch',
        alignItems: 'center' }}
    >
      <View
        style={{
          width: layoutBoardW || '100%',
          maxWidth: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: V.border }}
      >
        <View style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }}>
      {/* Верхний бар прозрачный — под ним виден остров; фишки и кнопка остаются непрозрачными */}
      <View style={[tw`flex-row items-center justify-between px-2 py-1`, { backgroundColor: 'transparent' }]}>
        <View style={tw`flex-row items-center`}>
          <TouchableOpacity
            onPress={() => onBearOffPress(2)}
            style={[
              tw`flex-row items-center`,
              offHighlight && playerNumber === 2 && { backgroundColor: 'rgba(90,158,154,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }]}
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
              offHighlight && playerNumber === 1 && {backgroundColor: 'rgba(90,158,154,0.18)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2}]}
          >
            <Text style={[tw`text-[10px] font-medium mr-1`, { color: V.textPrimary }]}>{borneOff[1]}/15</Text>
            <Checker player={1} size={16} />
          </TouchableOpacity>
        </View>
      </View>

      <GestureDetector gesture={boardSwipeGesture}>
        <View
          ref={boardAreaRef}
          onLayout={() => {
            boardAreaRef.current?.measureInWindow((x, y) => {
              boardPos.current = { x, y };
            });
          }}
          collapsable={false}
          accessibilityLabel="Свайп для броска кубиков"
          style={{
            position: 'relative',
            width: layoutBoardW || '100%',
            minHeight: pointHeight * 2,
            backgroundColor: boardPalette.bg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: boardPalette.rim,
          }}
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
            zIndex: 1 }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: leftClusterCx - starSize / 2,
            top: pointHeight - starSize / 2,
            width: starSize,
            height: starSize,
            zIndex: 2 }}
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
            zIndex: 2 }}
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
              elevation: 10 }}
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
              elevation: 50 }}
          >
            {diceOverlay}
          </View>
        )}
        <BoardOverlayHint
          isMyTurn={isMyTurn}
          turnPhase={turnPhase}
          selfPlay={selfPlay}
          opponentOnline={opponentOnline}
        />
        {swipeHintOverlay}
        </View>
      </GestureDetector>

      {children}
        </View>
      </View>
    </View>
  );
}));

export default BackgammonBoard;
