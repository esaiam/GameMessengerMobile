import { useRef, useCallback, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Общие Animated.Value по id сообщения: появление новых строк, pop при удалении,
 * перенос значений с tempId на реальный id при подтверждении видео.
 * Объекты fadeAnims / scaleAnims стабильны (mutate in place) — realtime и optimistic video полагаются на это.
 */
export default function useMessageRowAnimations(messages) {
  const fadeAnims = useRef({}).current;
  const scaleAnims = useRef({}).current;

  const ensureMessageAnims = useCallback(
    (id) => {
      if (!fadeAnims[id]) fadeAnims[id] = new Animated.Value(1);
      if (!scaleAnims[id]) scaleAnims[id] = new Animated.Value(1);
      return { opacity: fadeAnims[id], scale: scaleAnims[id] };
    },
    [fadeAnims, scaleAnims],
  );

  const popMessage = useCallback(
    (id, opts = {}) => {
      const { opacity, scale } = ensureMessageAnims(id);
      const duration = opts.duration ?? 180;
      const toScale = opts.toScale ?? 0.6;
      return new Promise((resolve) => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }),
          Animated.timing(scale, { toValue: toScale, duration, useNativeDriver: true })]).start(({ finished }) => resolve(!!finished));
      });
    },
    [ensureMessageAnims],
  );

  /** Откат pop-анимации (например, когда удаление на сервере не удалось). */
  const restoreMessage = useCallback(
    (id, opts = {}) => {
      const { opacity, scale } = ensureMessageAnims(id);
      const duration = opts.duration ?? 160;
      return new Promise((resolve) => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true })]).start(({ finished }) => resolve(!!finished));
      });
    },
    [ensureMessageAnims],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const currentIds = new Set(messages.map((m) => m.id));
      Object.keys(fadeAnims).forEach((animId) => {
        if (!currentIds.has(animId)) {
          delete fadeAnims[animId];
          delete scaleAnims[animId];
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, fadeAnims, scaleAnims]);

  return { fadeAnims, scaleAnims, ensureMessageAnims, popMessage, restoreMessage };
}
