import { useMemo } from 'react';
import { Animated, Dimensions } from 'react-native';
import {
  DRAG_MAX_EXTRA_H,
  HANDLE_NARROW_RATIO,
  BOTTOM_R_COLLAPSED,
  BOTTOM_R_FULL,
  BOARD_SIDE_GAP,
} from './gameScreenConstants';

export default function useGameBoardHandleStyles({
  handleStretchAnim,
  handleWidthAnim,
  middlePulseAnim,
  boardColW,
  windowW,
  boardMaxW,
}) {
  const fullStripW = useMemo(() => {
    if (boardColW > 0) return boardColW;
    return windowW || Dimensions.get('window').width;
  }, [boardColW, windowW]);

  const narrowStripW = useMemo(() => Math.max(48, Math.floor(fullStripW / 5)), [fullStripW]);

  const animatedHandleH = useMemo(
    () =>
      Animated.add(
        28,
        Animated.add(
          Animated.multiply(handleStretchAnim, DRAG_MAX_EXTRA_H),
          Animated.multiply(middlePulseAnim, DRAG_MAX_EXTRA_H * 0.5),
        ),
      ),
    [handleStretchAnim, middlePulseAnim],
  );

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

  const oneMinusHandleWidth = useMemo(
    () =>
      handleWidthAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }),
    [handleWidthAnim],
  );

  const oneMinusStretch = useMemo(
    () =>
      handleStretchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }),
    [handleStretchAnim],
  );

  const bottomRDrag = useMemo(
    () =>
      Animated.add(
        Animated.multiply(oneMinusStretch, BOTTOM_R_COLLAPSED),
        Animated.multiply(handleStretchAnim, Animated.multiply(dragHandleW, 0.5)),
      ),
    [oneMinusStretch, handleStretchAnim, dragHandleW],
  );

  const bottomR = useMemo(
    () =>
      Animated.add(
        Animated.multiply(oneMinusHandleWidth, bottomRDrag),
        Animated.multiply(handleWidthAnim, BOTTOM_R_FULL),
      ),
    [oneMinusHandleWidth, bottomRDrag, handleWidthAnim],
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

  return {
    animatedHandleH,
    animatedHandleW,
    dragHandleW,
    bottomR,
    stripWidthAnim,
    boardRenderW,
  };
}
