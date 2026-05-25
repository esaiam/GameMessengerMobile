import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

const RIPPLE_COLOR = 'rgba(90, 158, 154, 0.2)';

/**
 * Custom press ripple for chats list rows.
 * Defers onPress one tick so ripple can paint before navigation.
 */
export function useChatsListRowRipple(onRowPress) {
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const [ripple, setRipple] = useState({ visible: false, x: 0, y: 0 });
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rippleAnimRef = useRef(null);
  const navigateTimerRef = useRef(null);

  const maxD =
    layout.w > 0 && layout.h > 0
      ? Math.ceil(Math.sqrt(layout.w * layout.w + layout.h * layout.h) * 2)
      : 0;

  useLayoutEffect(() => {
    if (!ripple.visible || maxD <= 0) return undefined;
    rippleAnimRef.current?.stop?.();
    const anim = Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]);
    rippleAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        scaleAnim.setValue(0);
        opacityAnim.setValue(0);
        setRipple((r) => ({ ...r, visible: false }));
      }
    });
    return () => anim.stop();
  }, [ripple.visible, ripple.x, ripple.y, maxD, scaleAnim, opacityAnim]);

  const onLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  }, []);

  const onPressIn = useCallback(
    (e) => {
      const { locationX, locationY } = e.nativeEvent;
      rippleAnimRef.current?.stop?.();
      scaleAnim.setValue(0);
      opacityAnim.setValue(1);
      setRipple({ visible: true, x: locationX, y: locationY });
    },
    [scaleAnim, opacityAnim],
  );

  const onPress = useCallback(() => {
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    navigateTimerRef.current = setTimeout(() => {
      navigateTimerRef.current = null;
      onRowPress();
    }, 0);
  }, [onRowPress]);

  useEffect(
    () => () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    },
    [],
  );

  const rippleOverlay =
    ripple.visible && maxD > 0 ? (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: ripple.x - maxD / 2,
          top: ripple.y - maxD / 2,
          width: maxD,
          height: maxD,
          borderRadius: maxD / 2,
          backgroundColor: RIPPLE_COLOR,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      />
    ) : null;

  return { onLayout, onPressIn, onPress, rippleOverlay };
}
