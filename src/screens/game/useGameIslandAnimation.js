/**
 * useGameIslandAnimation — FSM + анимации для Dynamic Island–хаба игр.
 *
 * FSM состояния:
 *   'collapsed'    — компактный чёрный pill с иконкой кубиков
 *   'picker'       — island расширяется, появляются иконки игр из registry
 *   'gameExpanded' — остров раскрылся до размера доски выбранной игры
 *
 * Переходы:
 *   collapsed  + TAP              → picker (registry.length > 1)
 *   collapsed  + TAP              → gameExpanded (registry.length === 1)
 *   picker     + TAP_GAME(id)     → иконки сдуваются → gameExpanded
 *   picker     + DISMISS / повт.TAP → collapsed
 *   gameExpanded + SWIPE_UP       → collapsed (если !dice busy)
 *   gameExpanded + SWIPE_UP       → bounce back (если dice busy)
 *   gameExpanded + kbVisible/emoji  → shell unmount, FSM сохраняется; при закрытии — restore
 *
 * Animated.Value (useNativeDriver: false) — layout: boardDropAnim, handleWidthAnim,
 *   handleStretchAnim, pickerHeightAnim.
 * Animated.Value (useNativeDriver: true) — transform/opacity: pickerIconAnims,
 *   boardContentFadeAnim.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';
import { gameRegistry } from './gameRegistry';
import { ISLAND_BOTTOM_GAP, ISLAND_COLLAPSED_H, computeTabletBoardAreaH } from './gameScreenConstants';

// ─── Константы ───────────────────────────────────────────────────────────────

/** Высота pill в picker (без подписей — только иконки) */
export const ISLAND_PICKER_H = 48;
/**
 * Доля ширины экрана для picker (handleWidthAnim target).
 * На 390px: ≈ 172px — ровно на 3 иконки с минимальными отступами.
 */
const PICKER_WIDTH_RATIO = 0.30;
const HANDLE_H = ISLAND_COLLAPSED_H;

// ─── FSM ──────────────────────────────────────────────────────────────────────

/** @typedef {'collapsed' | 'picker' | 'gameExpanded'} IslandState */

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameIslandAnimation({
  kbVisible,
  emojiPickerVisible,
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
  frostedHeaderH,
  maxBoardH,
  bottomGap = ISLAND_BOTTOM_GAP,
  tabletBoardTarget = false,
}) {
  // ── FSM ────────────────────────────────────────────────────────────────────

  const [islandState, setIslandState] = useState(/** @type {IslandState} */ ('collapsed'));
  const islandStateRef = useRef(/** @type {IslandState} */ ('collapsed'));

  const [activeGameId, setActiveGameId] = useState(/** @type {string|null} */ (null));

  const _transition = useCallback((/** @type {IslandState} */ next) => {
    islandStateRef.current = next;
    setIslandState(next);
  }, []);

  // ── Animated values (layout — useNativeDriver: false) ──────────────────────

  const boardDropAnim    = useRef(new Animated.Value(0)).current;
  const handleStretchAnim = useRef(new Animated.Value(0)).current;
  const handleWidthAnim  = useRef(new Animated.Value(0)).current;
  /** Высота нижней секции острова: collapsed ↔ picker */
  const pickerHeightAnim = useRef(new Animated.Value(ISLAND_COLLAPSED_H)).current;

  // ── Animated values (transform/opacity — useNativeDriver: true) ────────────

  /**
   * Иконки пикера: один объект {scale, opacity} на каждую игру в registry.
   * scale: 0 → 1 при появлении, 1 → 1.2 → 0 при выборе игры.
   */
  const pickerIconAnims = useRef(
    gameRegistry.map(() => ({
      scale:   new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  /** Fade-in доски после раскрытия island */
  const boardContentFadeAnim = useRef(new Animated.Value(0)).current;

  // ── Layout refs ────────────────────────────────────────────────────────────

  const maxSlideRef        = useRef(600);
  const boardColTopYRef    = useRef(/** @type {number|null} */ (null));
  const chatInputTopYRef   = useRef(/** @type {number|null} */ (null));
  const suppressAvailableHRef = useRef(false);
  const boardOpenRef       = useRef(false);
  const boardDropStartRef  = useRef(0);
  /** Была открыта доска до скрытия shell (KB / emoji panel) */
  const layoutObscuredRef  = useRef(false);
  const pendingBoardRevealRef = useRef(/** @type {{ finalH: number } | null} */ (null));
  const boardFadeStartedRef = useRef(false);
  const boardFadeFallbackRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  /** После раскрытия не пересчитываем высоту — composer/iY дрейфует и дёргает низ острова. */
  const openHeightLockedRef = useRef(false);
  const [boardInteractReady, setBoardInteractReady] = useState(false);

  // ── computeMaxSlide ────────────────────────────────────────────────────────

  const capBoardH = useCallback((h) => {
    const raw = Math.max(200, h);
    if (typeof maxBoardH === 'number' && maxBoardH > 0) {
      return Math.min(raw, maxBoardH);
    }
    return raw;
  }, [maxBoardH]);

  const resolveBoardAreaH = useCallback((bY, iY) => {
    if (tabletBoardTarget && typeof maxBoardH === 'number' && maxBoardH > 0) {
      return computeTabletBoardAreaH(bY, iY, maxBoardH);
    }
    if (typeof bY !== 'number' || typeof iY !== 'number' || iY <= bY) {
      return typeof maxBoardH === 'number' && maxBoardH > 0 ? maxBoardH : maxSlideRef.current;
    }
    return capBoardH(iY - bY - HANDLE_H - bottomGap);
  }, [tabletBoardTarget, maxBoardH, capBoardH, bottomGap]);

  const computeMaxSlide = useCallback(() => {
    if (suppressAvailableHRef.current || openHeightLockedRef.current) return;
    const bY = boardColTopYRef.current;
    const iY = chatInputTopYRef.current;
    if (typeof bY === 'number' && typeof iY === 'number') {
      const avail = resolveBoardAreaH(bY, iY);
      maxSlideRef.current = avail;
      if (!suppressAvailableHRef.current) setAvailableH(avail);
      return;
    }
    if (tabletBoardTarget && typeof maxBoardH === 'number' && maxBoardH > 0) {
      maxSlideRef.current = maxBoardH;
      if (!suppressAvailableHRef.current) setAvailableH(maxBoardH);
    }
  }, [setAvailableH, resolveBoardAreaH, tabletBoardTarget, maxBoardH]);

  // ── pauseJsForDiceThrow ────────────────────────────────────────────────────

  const pauseJsForDiceThrow = useCallback(() => {
    renderPausedRef.current = true;
    boardDropAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    handleStretchAnim.stopAnimation();
    boardRef.current?.pauseRendering();
  }, [boardDropAnim, handleWidthAnim, handleStretchAnim, boardRef, renderPausedRef]);

  // ── _resetPickerAnims ──────────────────────────────────────────────────────

  const _resetPickerAnims = useCallback(() => {
    pickerIconAnims.forEach(({ scale, opacity }) => {
      scale.setValue(0);
      opacity.setValue(0);
    });
    pickerHeightAnim.setValue(ISLAND_COLLAPSED_H);
  }, [pickerIconAnims, pickerHeightAnim]);

  const startBoardContentFade = useCallback(() => {
    if (boardFadeStartedRef.current) return;
    boardFadeStartedRef.current = true;
    pendingBoardRevealRef.current = null;
    if (boardFadeFallbackRef.current) {
      clearTimeout(boardFadeFallbackRef.current);
      boardFadeFallbackRef.current = null;
    }
    requestAnimationFrame(() => {
      Animated.timing(boardContentFadeAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        suppressAvailableHRef.current = false;
        setBoardInteractReady(true);
      });
    });
  }, [boardContentFadeAnim]);

  const notifyBoardLayoutReady = useCallback(() => {
    if (!pendingBoardRevealRef.current) return;
    startBoardContentFade();
  }, [startBoardContentFade]);

  // ── runOpenSequence ────────────────────────────────────────────────────────

  const runOpenSequence = useCallback((/** @type {string} */ gameId) => {
    suppressAvailableHRef.current = true;
    openHeightLockedRef.current = false;
    boardOpenRef.current = true;
    setActiveGameId(gameId);
    setBoardContentActive(false);
    setBoardInteractReady(false);
    _transition('gameExpanded');
    boardContentFadeAnim.setValue(0);
    handleStretchAnim.setValue(0);

    if (!boardMountedRef.current) {
      boardMountedRef.current = true;
      setBoardMounted(true);
    }

    const prepBoardReveal = (targetH) => {
      boardFadeStartedRef.current = false;
      openHeightLockedRef.current = true;
      pendingBoardRevealRef.current = { finalH: targetH };
      maxSlideRef.current = targetH;
      setAvailableH(targetH);
      setBoardContentActive(true);
      if (boardFadeFallbackRef.current) clearTimeout(boardFadeFallbackRef.current);
      boardFadeFallbackRef.current = setTimeout(() => {
        boardFadeFallbackRef.current = null;
        if (pendingBoardRevealRef.current) startBoardContentFade();
      }, 120);
    };

    const doOpen = (targetH) => {
      maxSlideRef.current = targetH;

      Animated.parallel([
        Animated.spring(handleWidthAnim, {
          toValue: 1,
          damping: 25,
          stiffness: 900,
          mass: 0.35,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(boardDropAnim, {
            toValue: targetH,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]),
      ]).start(({ finished }) => {
        if (!finished) return;
        prepBoardReveal(targetH);
      });
    };

    boardColRef.current?.measureInWindow((_x, bY) => {
      const iY = chatInputTopYRef.current;
      doOpen(resolveBoardAreaH(bY, iY));
    });
  }, [
    _transition,
    boardDropAnim, handleStretchAnim, handleWidthAnim,
    boardContentFadeAnim,
    boardColRef, boardMountedRef,
    setAvailableH, setBoardContentActive, setBoardMounted, resolveBoardAreaH, startBoardContentFade,
  ]);

  // ── runCloseSequence ───────────────────────────────────────────────────────

  const runCloseSequence = useCallback(() => {
    if (showAnimDiceRef.current || diceAnimatingRef.current) return;

    suppressAvailableHRef.current = true;
    openHeightLockedRef.current = false;
    boardOpenRef.current = false;
    setActiveGameId(null);
    pendingBoardRevealRef.current = null;
    boardFadeStartedRef.current = false;
    setBoardInteractReady(false);
    if (boardFadeFallbackRef.current) {
      clearTimeout(boardFadeFallbackRef.current);
      boardFadeFallbackRef.current = null;
    }
    boardContentFadeAnim.setValue(0);
    handleStretchAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    boardDropAnim.stopAnimation();
    pickerHeightAnim.stopAnimation();
    handleStretchAnim.setValue(0);
    pickerHeightAnim.setValue(ISLAND_COLLAPSED_H);

    const afterBoardCollapsed = () => {
      setBoardContentActive(false);
      _transition('collapsed');
      pickerHeightAnim.setValue(ISLAND_COLLAPSED_H);
      Animated.timing(handleWidthAnim, {
        toValue: 0, duration: 280,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start(() => {
        if (!showAnimDiceRef.current) renderPausedRef.current = false;
        suppressAvailableHRef.current = false;
        computeMaxSlide();
      });
    };

    const collapseBoardHeightOnly = () => {
      Animated.timing(boardDropAnim, {
        toValue: 0, duration: 220,
        easing: Easing.in(Easing.quad), useNativeDriver: false,
      }).start(afterBoardCollapsed);
    };

    handleWidthAnim.stopAnimation((w) => {
      const curW = typeof w === 'number' ? w : 0;
      if (curW >= 0.99) {
        collapseBoardHeightOnly();
      } else {
        Animated.timing(handleWidthAnim, {
          toValue: 1, duration: 160,
          easing: Easing.out(Easing.quad), useNativeDriver: false,
        }).start(collapseBoardHeightOnly);
      }
    });
  }, [
    _transition,
    boardDropAnim, handleStretchAnim, handleWidthAnim, pickerHeightAnim, boardContentFadeAnim,
    computeMaxSlide, diceAnimatingRef, renderPausedRef, setBoardContentActive, showAnimDiceRef,
    setActiveGameId,
  ]);

  // ── Refs для PanResponder ──────────────────────────────────────────────────

  const openRef  = useRef(runOpenSequence);
  const closeRef = useRef(runCloseSequence);
  openRef.current  = runOpenSequence;
  closeRef.current = runCloseSequence;

  // ── _enterPicker ───────────────────────────────────────────────────────────

  const _enterPicker = useCallback(() => {
    _transition('picker');

    // Расширить ширину и высоту pill (layout, не native driver)
    Animated.spring(handleWidthAnim, {
      toValue: PICKER_WIDTH_RATIO,
      speed: 22, bounciness: 3,
      useNativeDriver: false,
    }).start();
    Animated.spring(pickerHeightAnim, {
      toValue: ISLAND_PICKER_H,
      speed: 22, bounciness: 3,
      useNativeDriver: false,
    }).start();

    // Иконки: stagger scale+opacity in (native driver)
    Animated.stagger(
      55,
      pickerIconAnims.map(({ scale, opacity }) =>
        Animated.parallel([
          Animated.spring(scale,   { toValue: 1, speed: 28, bounciness: 8, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ),
    ).start();
  }, [_transition, handleWidthAnim, pickerHeightAnim, pickerIconAnims]);

  // ── tapIsland ──────────────────────────────────────────────────────────────

  const tapIsland = useCallback(() => {
    const s = islandStateRef.current;
    if (s === 'collapsed') {
      if (gameRegistry.length === 1) {
        openRef.current(gameRegistry[0].id);
      } else {
        _enterPicker();
      }
    } else if (s === 'picker') {
      // Повторный tap — схлопнуть picker
      Animated.timing(handleWidthAnim, {
        toValue: 0, duration: 200,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start(() => _transition('collapsed'));
      Animated.timing(pickerHeightAnim, {
        toValue: ISLAND_COLLAPSED_H, duration: 200,
        easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
      Animated.parallel(
        pickerIconAnims.flatMap(({ scale, opacity }) => [
          Animated.timing(scale,   { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 130, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
      ).start(() => _resetPickerAnims());
    }
  }, [_enterPicker, _transition, _resetPickerAnims, handleWidthAnim, pickerHeightAnim, pickerIconAnims]);

  // ── tapGameIcon ────────────────────────────────────────────────────────────

  const tapGameIcon = useCallback((/** @type {string} */ id) => {
    if (islandStateRef.current !== 'picker') return;

    // 1. Иконки надуваются (pop)
    Animated.parallel(
      pickerIconAnims.map(({ scale }) =>
        Animated.timing(scale, { toValue: 1.25, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ),
    ).start(() => {
      // 2. Иконки схлопываются в 0
      Animated.parallel(
        pickerIconAnims.flatMap(({ scale, opacity }) => [
          Animated.timing(scale,   { toValue: 0, duration: 130, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 110, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
      ).start(() => {
        // 3. Сброс размеров picker, запуск раскрытия доски
        pickerHeightAnim.setValue(ISLAND_COLLAPSED_H);
        pickerIconAnims.forEach(({ scale, opacity }) => { scale.setValue(0); opacity.setValue(0); });
        openRef.current(id);
      });
    });
  }, [pickerIconAnims, pickerHeightAnim]);

  // ── dismissPicker ──────────────────────────────────────────────────────────

  const dismissPicker = useCallback(() => {
    if (islandStateRef.current !== 'picker') return;

    // Схлопнуть pill (layout)
    Animated.timing(handleWidthAnim, {
      toValue: 0, duration: 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => { _transition('collapsed'); _resetPickerAnims(); });
    Animated.timing(pickerHeightAnim, {
      toValue: ISLAND_COLLAPSED_H, duration: 200,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();

    // Иконки fade out (native driver, параллельно)
    Animated.parallel(
      pickerIconAnims.flatMap(({ scale, opacity }) => [
        Animated.timing(scale,   { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 130, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
    ).start();
  }, [_transition, _resetPickerAnims, handleWidthAnim, pickerHeightAnim, pickerIconAnims]);

  // ── PanResponder ───────────────────────────────────────────────────────────

  const slidePan = useRef(
    PanResponder.create({
      // В picker касания отдаём иконкам
      onStartShouldSetPanResponder: () => islandStateRef.current !== 'picker',
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dy) > 5 && islandStateRef.current !== 'picker',
      onPanResponderGrant: () => {
        handleStretchAnim.stopAnimation();
        handleWidthAnim.stopAnimation();
        if (boardOpenRef.current) {
          boardDropAnim.stopAnimation((v) => { boardDropStartRef.current = v; });
        }
      },
      onPanResponderMove: (_, gs) => {
        if (boardOpenRef.current) {
          if (showAnimDiceRef.current || diceAnimatingRef.current) return;
          const next = Math.max(0, Math.min(maxSlideRef.current, boardDropStartRef.current + gs.dy));
          boardDropAnim.setValue(next);
          return;
        }
        handleStretchAnim.setValue(Math.min(1, Math.max(0, gs.dy) / 120));
      },
      onPanResponderRelease: (_, gs) => {
        if (boardOpenRef.current) {
          const maxH = maxSlideRef.current;
          const cur  = Math.max(0, Math.min(maxH, boardDropStartRef.current + gs.dy));
          if (gs.vy < -0.5 || cur < maxH * 0.4) {
            if (showAnimDiceRef.current || diceAnimatingRef.current) {
              Animated.timing(boardDropAnim, { toValue: maxH, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
            } else {
              closeRef.current();
            }
          } else {
            Animated.timing(boardDropAnim, { toValue: maxH, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
          }
          return;
        }
        // collapsed: сброс stretch + открыть (tap или drag вниз)
        Animated.timing(handleStretchAnim, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        if (gs.dy >= -5) tapIsland();
      },
      onPanResponderTerminate: () => {
        if (!boardOpenRef.current) {
          Animated.timing(handleStretchAnim, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!showAnimDice) {
      renderPausedRef.current = false;
      if (boardOpenRef.current) {
        boardDropAnim.setValue(maxSlideRef.current);
        handleWidthAnim.setValue(1);
        handleStretchAnim.setValue(0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnimDice]);

  useEffect(() => {
    if (kbVisible) return;
    chatInputTopYRef.current = null;
    const t = setTimeout(() => computeMaxSlide(), 300);
    return () => clearTimeout(t);
  }, [kbVisible, computeMaxSlide]);

  /** После KB/emoji: вернуть раскрытые нарды, не схлопывать в «длинный bar» */
  useEffect(() => {
    const obscured = kbVisible || emojiPickerVisible;
    if (obscured) {
      layoutObscuredRef.current =
        islandStateRef.current === 'gameExpanded' && boardOpenRef.current;
      return;
    }
    if (!layoutObscuredRef.current) return;
    layoutObscuredRef.current = false;
    if (islandStateRef.current !== 'gameExpanded') return;

    boardOpenRef.current = true;
    setBoardContentActive(true);
    handleStretchAnim.setValue(0);
    pickerHeightAnim.setValue(ISLAND_COLLAPSED_H);
    handleWidthAnim.setValue(1);
    boardContentFadeAnim.setValue(1);
    boardDropAnim.setValue(maxSlideRef.current);

    const t = setTimeout(() => {
      computeMaxSlide();
      boardDropAnim.setValue(maxSlideRef.current);
    }, 320);
    return () => clearTimeout(t);
  }, [kbVisible, emojiPickerVisible, computeMaxSlide, setBoardContentActive]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (suppressAvailableHRef.current || openHeightLockedRef.current) return;
      computeMaxSlide();
      if (boardOpenRef.current) {
        boardDropAnim.setValue(maxSlideRef.current);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [frostedHeaderH, bottomGap, maxBoardH, tabletBoardTarget, computeMaxSlide, boardDropAnim]);

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    // FSM
    islandState,
    activeGameId,
    boardInteractReady,

    // Animated values (layout)
    boardDropAnim,
    handleStretchAnim,
    handleWidthAnim,
    pickerHeightAnim,

    // Animated values (native driver)
    pickerIconAnims,
    boardContentFadeAnim,

    // Layout refs (наружу — только то, что читает GameScreen)
    boardColTopYRef,
    chatInputTopYRef,
    suppressAvailableHRef,

    // Actions
    tapGameIcon,
    dismissPicker,
    runCloseSequence,
    computeMaxSlide,
    pauseJsForDiceThrow,
    notifyBoardLayoutReady,

    // Pan
    slidePan,
  };
}
