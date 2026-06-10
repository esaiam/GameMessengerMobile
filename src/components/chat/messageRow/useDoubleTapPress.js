import { useCallback, useEffect, useRef } from 'react';

const DOUBLE_TAP_DELAY_MS = 200;

/** Снимок координат до recycle synthetic event (single-tap откладывается на DOUBLE_TAP_DELAY_MS). */
export function snapshotPressEvent(event) {
  const x = event?.nativeEvent?.pageX ?? 0;
  const y = event?.nativeEvent?.pageY ?? 0;
  return { nativeEvent: { pageX: x, pageY: y } };
}

/** Одиночный тап — отложенно; второй в окне — double (без срабатывания single). */
export function useDoubleTapPress(onSingleTap, onDoubleTap) {
  const lastTapAtRef = useRef(0);
  const pendingSingleRef = useRef(null);

  useEffect(
    () => () => {
      if (pendingSingleRef.current != null) {
        clearTimeout(pendingSingleRef.current);
        pendingSingleRef.current = null;
      }
    },
    [],
  );

  return useCallback(
    (event) => {
      const pressSnapshot = snapshotPressEvent(event);
      const now = Date.now();
      if (now - lastTapAtRef.current < DOUBLE_TAP_DELAY_MS) {
        if (pendingSingleRef.current != null) {
          clearTimeout(pendingSingleRef.current);
          pendingSingleRef.current = null;
        }
        lastTapAtRef.current = 0;
        onDoubleTap(pressSnapshot);
        return;
      }
      lastTapAtRef.current = now;
      if (pendingSingleRef.current != null) {
        clearTimeout(pendingSingleRef.current);
      }
      pendingSingleRef.current = setTimeout(() => {
        pendingSingleRef.current = null;
        onSingleTap(pressSnapshot);
      }, DOUBLE_TAP_DELAY_MS);
    },
    [onSingleTap, onDoubleTap],
  );
}
