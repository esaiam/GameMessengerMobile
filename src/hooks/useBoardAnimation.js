import { useRef, useEffect, useCallback } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';

const HANDLE_H = 28;
const BOTTOM_GAP = 68;
const MIN_DRAG_THRESHOLD = 20;

export function useBoardAnimation({
  showAnimDice,
  showAnimDiceRef,
  diceAnimatingRef,
  renderPausedRef,
  boardRef,
  boardColRef,
  boardMountedRef,
  setAvailableH,
  setBoardMounted,
  setBoardContentActive,
  kbVisible,
  frostedHeaderH,
}) {
  const maxSlideRef = useRef(600);
  const boardColTopYRef = useRef(null);
  const chatInputTopYRef = useRef(null);
  const boardOpenRef = useRef(false);
  /** Не вызывать setAvailableH во время анимации доски — меньше ререндеров и джанка layout */
  const suppressAvailableHRef = useRef(false);

  const handleStretchAnim = useRef(new Animated.Value(0)).current;
  const handleWidthAnim = useRef(new Animated.Value(0)).current;
  const boardDropAnim = useRef(new Animated.Value(0)).current;
  const middlePulseAnim = useRef(new Animated.Value(0)).current;
  const boardDropStartRef = useRef(0);

  const pauseJsForDiceThrow = useCallback(() => {
    renderPausedRef.current = true;
    boardDropAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    handleStretchAnim.stopAnimation();
    middlePulseAnim.stopAnimation();
    boardRef.current?.pauseRendering();
  }, [boardDropAnim, handleWidthAnim, handleStretchAnim, middlePulseAnim]);

  useEffect(() => {
    if (!showAnimDice) {
      renderPausedRef.current = false;
      if (boardOpenRef.current) {
        const maxH = maxSlideRef.current;
        boardDropAnim.setValue(maxH);
        handleWidthAnim.setValue(1);
        handleStretchAnim.setValue(0);
        middlePulseAnim.setValue(0);
      }
    }
  }, [showAnimDice, boardDropAnim, handleWidthAnim, handleStretchAnim, middlePulseAnim]);

  const computeMaxSlide = useCallback(() => {
    const bY = boardColTopYRef.current;
    const iY = chatInputTopYRef.current;
    if (typeof bY === 'number' && typeof iY === 'number') {
      const avail = Math.max(200, iY - bY - HANDLE_H - BOTTOM_GAP);
      maxSlideRef.current = avail;
      if (!suppressAvailableHRef.current) setAvailableH(avail);
    }
    // Если нет обоих значений — не перетираем maxSlideRef, оставляем последнее известное
  }, []);

  const runOpenSequence = useCallback(() => {
    suppressAvailableHRef.current = true;
    boardOpenRef.current = true;
    setBoardContentActive(true);
    middlePulseAnim.setValue(0);

    const doOpen = (freshMaxH) => {
      maxSlideRef.current = freshMaxH;
      setAvailableH(freshMaxH);

      Animated.timing(handleStretchAnim, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

      Animated.timing(handleWidthAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        const firstMount = !boardMountedRef.current;
        if (firstMount) {
          boardMountedRef.current = true;
          setBoardMounted(true);
        }
        const startBoardDrop = () => {
          Animated.timing(boardDropAnim, {
            toValue: freshMaxH,
            duration: 380,
            easing: Easing.in(Easing.quad),
            useNativeDriver: false,
          }).start(() => {
            Animated.sequence([
              Animated.timing(boardDropAnim, {
                toValue: freshMaxH - 18,
                duration: 100,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
              }),
              Animated.timing(boardDropAnim, {
                toValue: freshMaxH,
                duration: 100,
                easing: Easing.in(Easing.quad),
                useNativeDriver: false,
              }),
              Animated.timing(boardDropAnim, {
                toValue: freshMaxH - 5,
                duration: 60,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
              }),
              Animated.timing(boardDropAnim, {
                toValue: freshMaxH,
                duration: 60,
                easing: Easing.in(Easing.quad),
                useNativeDriver: false,
              }),
            ]).start(() => {
              suppressAvailableHRef.current = false;
              computeMaxSlide();
            });
          });
        };
        if (firstMount) {
          requestAnimationFrame(() => requestAnimationFrame(startBoardDrop));
        } else {
          startBoardDrop();
        }
      });
    };

    boardColRef.current?.measureInWindow((_x, bY) => {
      const iY = chatInputTopYRef.current;
      if (typeof bY === 'number' && typeof iY === 'number' && iY > bY) {
        const fresh = Math.max(200, iY - bY - HANDLE_H - BOTTOM_GAP);
        doOpen(fresh);
      } else {
        doOpen(maxSlideRef.current);
      }
    });
  }, [handleStretchAnim, handleWidthAnim, boardDropAnim, middlePulseAnim, computeMaxSlide]);

  const runCloseSequence = useCallback(() => {
    if (showAnimDiceRef.current || diceAnimatingRef.current) {
      return;
    }
    suppressAvailableHRef.current = true;
    boardOpenRef.current = false;
    handleStretchAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    boardDropAnim.stopAnimation();
    middlePulseAnim.stopAnimation();
    handleStretchAnim.setValue(0);
    middlePulseAnim.setValue(0);

    const afterBoardCollapsed = () => {
      setBoardContentActive(false);
      Animated.timing(handleWidthAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        if (!showAnimDiceRef.current) {
          renderPausedRef.current = false;
        }
        suppressAvailableHRef.current = false;
        computeMaxSlide();
      });
    };

    const collapseBoardHeightOnly = () => {
      Animated.timing(boardDropAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }).start(afterBoardCollapsed);
    };

    handleWidthAnim.stopAnimation((w) => {
      const curW = typeof w === 'number' ? w : 0;
      if (curW >= 0.99) {
        collapseBoardHeightOnly();
      } else {
        Animated.timing(handleWidthAnim, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(collapseBoardHeightOnly);
      }
    });
  }, [handleStretchAnim, handleWidthAnim, boardDropAnim, middlePulseAnim, computeMaxSlide]);

  const openRef = useRef(runOpenSequence);
  const closeRef = useRef(runCloseSequence);
  useEffect(() => { openRef.current = runOpenSequence; }, [runOpenSequence]);
  useEffect(() => { closeRef.current = runCloseSequence; }, [runCloseSequence]);

  const slidePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        handleStretchAnim.stopAnimation();
        handleWidthAnim.stopAnimation();
        middlePulseAnim.stopAnimation();
        if (boardOpenRef.current) {
          boardDropAnim.stopAnimation((v) => { boardDropStartRef.current = v; });
        }
      },
      onPanResponderMove: (_, gs) => {
        if (boardOpenRef.current) {
          if (showAnimDiceRef.current || diceAnimatingRef.current) {
            return;
          }
          const maxH = maxSlideRef.current;
          const next = Math.max(0, Math.min(maxH, boardDropStartRef.current + gs.dy));
          boardDropAnim.setValue(next);
          return;
        }
        const dy = Math.max(0, gs.dy);
        const t = Math.min(1, dy / 120);
        handleStretchAnim.setValue(t);
      },
      onPanResponderRelease: (_, gs) => {
        if (boardOpenRef.current) {
          const maxH = maxSlideRef.current;
          const cur = Math.max(0, Math.min(maxH, boardDropStartRef.current + gs.dy));
          const vy = gs.vy;
          if (vy < -0.5 || cur < maxH * 0.4) {
            if (showAnimDiceRef.current || diceAnimatingRef.current) {
              Animated.timing(boardDropAnim, {
                toValue: maxH,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
              }).start();
            } else {
              closeRef.current();
            }
          } else {
            Animated.timing(boardDropAnim, {
              toValue: maxH,
              duration: 220,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }).start();
          }
          return;
        }
        const dy = Math.max(0, gs.dy);
        if (dy > MIN_DRAG_THRESHOLD) {
          openRef.current();
        } else {
          Animated.timing(handleStretchAnim, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!boardOpenRef.current) {
          Animated.timing(handleStretchAnim, {
            toValue: 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (kbVisible) return;
    chatInputTopYRef.current = null;
    setTimeout(() => computeMaxSlide(), 300);
  }, [kbVisible, computeMaxSlide]);

  /** После измерения шапки чата пересчитать зону свайпа доски */
  useEffect(() => {
    const t = setTimeout(() => computeMaxSlide(), 0);
    return () => clearTimeout(t);
  }, [frostedHeaderH, computeMaxSlide]);

  return {
    handleStretchAnim,
    handleWidthAnim,
    boardDropAnim,
    middlePulseAnim,
    slidePan,
    boardOpenRef,
    suppressAvailableHRef,
    maxSlideRef,
    boardColTopYRef,
    chatInputTopYRef,
    boardDropStartRef,
    pauseJsForDiceThrow,
    computeMaxSlide,
    runOpenSequence,
    runCloseSequence,
  };
}
