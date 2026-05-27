import { useMemo } from 'react';
import { Animated, Dimensions } from 'react-native';
import { HANDLE_NARROW_RATIO, BOARD_SIDE_GAP } from './gameScreenConstants';

/**
 * Ширина острова (stripWidthAnim) и внутренняя ширина доски (boardRenderW).
 * Legacy handle height / border-radius удалены вместе с GameBoardColumn.
 */
export default function useGameBoardHandleStyles({
  handleStretchAnim,
  handleWidthAnim,
  boardColW,
  windowW,
  boardMaxW,
}) {
  const fullStripW = useMemo(() => {
    if (boardColW > 0) return boardColW;
    return windowW || Dimensions.get('window').width;
  }, [boardColW, windowW]);

  const narrowStripW = useMemo(() => Math.max(48, Math.floor(fullStripW / 5)), [fullStripW]);

  const animatedHandleW = useMemo(
    () =>
      handleWidthAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [narrowStripW, fullStripW],
        extrapolate: 'clamp',
      }),
    [handleWidthAnim, narrowStripW, fullStripW],
  );

  const dragHandleW = useMemo(
    () =>
      handleStretchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [narrowStripW, Math.max(36, Math.floor(narrowStripW * HANDLE_NARROW_RATIO))],
        extrapolate: 'clamp',
      }),
    [handleStretchAnim, narrowStripW],
  );

  const stripWidthAnim = useMemo(
    () =>
      Animated.add(
        Animated.multiply(
          handleWidthAnim.interpolate({ inputRange: [0, 0.01], outputRange: [1, 0], extrapolate: 'clamp' }),
          dragHandleW,
        ),
        Animated.multiply(
          handleWidthAnim.interpolate({ inputRange: [0, 0.01], outputRange: [0, 1], extrapolate: 'clamp' }),
          animatedHandleW,
        ),
      ),
    [handleWidthAnim, dragHandleW, animatedHandleW],
  );

  const boardRenderW = useMemo(() => {
    const w = boardColW > 0 ? boardColW : fullStripW;
    const fallbackW = windowW || Dimensions.get('window').width;
    const raw = w || fallbackW;
    const insetW = Math.max(0, raw - BOARD_SIDE_GAP * 2);
    if (typeof boardMaxW === 'number' && boardMaxW > 0) {
      return Math.floor(Math.min(insetW, boardMaxW));
    }
    return Math.floor(insetW);
  }, [boardColW, fullStripW, windowW, boardMaxW]);

  return { stripWidthAnim, boardRenderW };
}
