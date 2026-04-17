import React from 'react';
import { Image, useWindowDimensions } from 'react-native';

const NOISE_TILE = require('../../assets/chat-noise.png');

/**
 * Едва заметный «белый шум» на фоне чата — слой между картинкой/затемнением и градиентами.
 * Без Skia: тот же Canvas давал «Expected arraybuffer as first parameter» в связке с Reanimated.
 *
 * Явные width/height по окну обязательны: иначе `Image` часто берёт intrinsic размер тайла
 * (~128×128) и `repeat` виден только в левом верхнем углу.
 */
function ChatBackgroundNoise() {
  const { width, height } = useWindowDimensions();
  if (width < 1 || height < 1) return null;

  return (
    <Image
      pointerEvents="none"
      source={NOISE_TILE}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        zIndex: 0,
        opacity: 0.06
      }}
      resizeMode="repeat"
    />
  );
}

export default React.memo(ChatBackgroundNoise);
