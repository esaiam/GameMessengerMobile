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
 *   any        + kbVisible        → collapsed (через unmount из GameScreen)
 *
 * Animated.Value (useNativeDriver: false) — layout: boardDropAnim, handleWidthAnim,
 *   handleStretchAnim, middlePulseAnim, pickerHeightAnim.
 * Animated.Value (useNativeDriver: true) — transform/opacity: pickerIconAnims,
 *   boardContentFadeAnim.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { Animated, Easing, PanResponder } from 'react-native';
import { gameRegistry } from './gameRegistry';

// ─── Константы ───────────────────────────────────────────────────────────────

/** Высота pill в collapsed */
export const ISLAND_COLLAPSED_H = 36;
/** Высота pill в picker (без подписей — только иконки) */
export const ISLAND_PICKER_H = 48;
/**
 * Доля ширины экрана для picker (handleWidthAnim target).
 * На 390px: ≈ 172px — ровно на 3 иконки с минимальными отступами.
 */
const PICKER_WIDTH_RATIO = 0.30;
const HANDLE_H = ISLAND_COLLAPSED_H;
/** Зазор между нижним краем острова и верхом ввода чата.
 *  68px — намеренно, чтобы аудиосообщения в чате оставались доступны при открытой доске. */
const BOTTOM_GAP = 68;

// ─── FSM ──────────────────────────────────────────────────────────────────────

/** @typedef {'collapsed' | 'picker' | 'gameExpanded'} IslandState */

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameIslandAnimation({
  kbVisible,
  // emojiPickerVisible — используется в GameScreen для условного рендера
  // eslint-disable-next-line no-unused-vars
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
}) {
  // ── FSM ────────────────────────────────────────────────────────────────────

  const [islandState, setIslandState] = useState(/** @type {IslandState} */ ('collapsed'));
  const islandStateRef = useRef(/** @type {IslandState} */ ('collapsed'));

  const [activeGameId, setActiveGameId] = useState(/** @type {string|null} */ (null));
  const activeGameIdRef = useRef(/** @type {string|null} */ (null));

  const _transition = useCallback((/** @type {IslandState} */ next) => {
    islandStateRef.current = next;
    setIslandState(next);
  }, []);

  // ── Animated values (layout — useNativeDriver: false) ──────────────────────

  const boardDropAnim    = useRef(new Animated.Value(0)).current;
  const handleStretchAnim = useRef(new Animated.Value(0)).current;
  const handleWidthAnim  = useRef(new Animated.Value(0)).current;
  const middlePulseAnim  = useRef(new Animated.Value(0)).current;
  /** Высота pill в picker; в collapsed/gameExpanded используется animatedHandleH */
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

  // ── computeMaxSlide ────────────────────────────────────────────────────────

  const computeMaxSlide = useCallback(() => {
    const bY = boardColTopYRef.current;
    const iY = chatInputTopYRef.current;
    if (typeof bY === 'number' && typeof iY === 'number') {
      const avail = Math.max(200, iY - bY - HANDLE_H - BOTTOM_GAP);
      maxSlideRef.current = avail;
      if (!suppressAvailableHRef.current) setAvailableH(avail);
    }
  }, [setAvailableH]);

  // ── pauseJsForDiceThrow ────────────────────────────────────────────────────

  const pauseJsForDiceThrow = useCallback(() => {
    renderPausedRef.current = true;
    boardDropAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    handleStretchAnim.stopAnimation();
    middlePulseAnim.stopAnimation();
    boardRef.current?.pauseRendering();
  }, [boardDropAnim, handleWidthAnim, handleStretchAnim, middlePulseAnim, boardRef, renderPausedRef]);

  // ── _resetPickerAnims ──────────────────────────────────────────────────────

  const _resetPickerAnims = useCallback(() => {
    pickerIconAnims.forEach(({ scale, opacity }) => {
      scale.setValue(0);
      opacity.setValue(0);
    });
    pickerHeightAnim.setValue(ISLAND_COLLAPSED_H);
  }, [pickerIconAnims, pickerHeightAnim]);

  // ── runOpenSequence ────────────────────────────────────────────────────────

  const runOpenSequence = useCallback((/** @type {string} */ gameId) => {
    suppressAvailableHRef.current = true;
    boardOpenRef.current = true;
    activeGameIdRef.current = gameId;
    setActiveGameId(gameId);
    setBoardContentActive(true);
    _transition('gameExpanded');
    middlePulseAnim.setValue(0);
    boardContentFadeAnim.setValue(0);
    handleStretchAnim.setValue(0);

    // Монтируем доску сразу — она скрыта (boardDropAnim=0, boardContentFadeAnim=0)
    if (!boardMountedRef.current) {
      boardMountedRef.current = true;
      setBoardMounted(true);
    }

    const doOpen = (freshMaxH) => {
      maxSlideRef.current = freshMaxH;
      setAvailableH(freshMaxH);

      /**
       * Ширина и высота острова расширяются одновременно — плавный spring без bounce.
       * damping высокий → критическое затухание, без колебаний.
       * Ширина чуть быстрее (stiffness выше) — остров "расцветает" горизонтально,
       * затем подтягивает высоту.
       */
      Animated.parallel([
        Animated.spring(handleWidthAnim, {
          toValue: 1,
          damping: 32,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: false,
        }),
        Animated.spring(boardDropAnim, {
          toValue: freshMaxH,
          damping: 38,
          stiffness: 160,
          mass: 1.1,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        suppressAvailableHRef.current = false;
        computeMaxSlide();
        // Контент плавно проявляется после раскрытия острова
        Animated.timing(boardContentFadeAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    };

    boardColRef.current?.measureInWindow((_x, bY) => {
      const iY = chatInputTopYRef.current;
      if (typeof bY === 'number' && typeof iY === 'number' && iY > bY) {
        doOpen(Math.max(200, iY - bY - HANDLE_H - BOTTOM_GAP));
      } else {
        doOpen(maxSlideRef.current);
      }
    });
  }, [
    _transition,
    boardDropAnim, handleStretchAnim, handleWidthAnim, middlePulseAnim,
    boardContentFadeAnim,
    boardColRef, boardMountedRef,
    computeMaxSlide, setAvailableH, setBoardContentActive, setBoardMounted,
  ]);

  // ── runCloseSequence ───────────────────────────────────────────────────────

  const runCloseSequence = useCallback(() => {
    if (showAnimDiceRef.current || diceAnimatingRef.current) return;

    suppressAvailableHRef.current = true;
    boardOpenRef.current = false;
    boardContentFadeAnim.setValue(0);
    handleStretchAnim.stopAnimation();
    handleWidthAnim.stopAnimation();
    boardDropAnim.stopAnimation();
    middlePulseAnim.stopAnimation();
    handleStretchAnim.setValue(0);
    middlePulseAnim.setValue(0);

    const afterBoardCollapsed = () => {
      setBoardContentActive(false);
      _transition('collapsed');
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
    boardDropAnim, handleStretchAnim, handleWidthAnim, middlePulseAnim, boardContentFadeAnim,
    computeMaxSlide, diceAnimatingRef, renderPausedRef, setBoardContentActive, showAnimDiceRef,
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
        middlePulseAnim.stopAnimation();
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
        middlePulseAnim.setValue(0);
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

  useEffect(() => {
    const t = setTimeout(() => computeMaxSlide(), 0);
    return () => clearTimeout(t);
  }, [frostedHeaderH, computeMaxSlide]);

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    // FSM
    islandState,
    activeGameId,

    // Animated values (layout)
    boardDropAnim,
    handleStretchAnim,
    handleWidthAnim,
    middlePulseAnim,
    pickerHeightAnim,

    // Animated values (native driver)
    pickerIconAnims,
    boardContentFadeAnim,

    // Layout refs
    boardColTopYRef,
    chatInputTopYRef,
    boardOpenRef,
    suppressAvailableHRef,
    maxSlideRef,
    boardDropStartRef,

    // Actions
    tapIsland,
    tapGameIcon,
    dismissPicker,
    runOpenSequence,
    runCloseSequence,
    computeMaxSlide,
    pauseJsForDiceThrow,

    // Pan
    slidePan,
  };
}
