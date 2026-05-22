/**
 * Размер превью фото/GIF в ленте (пропорции как в Telegram).
 * @param {number} naturalW
 * @param {number} naturalH
 * @param {number} maxWidth
 * @param {{ isGif?: boolean }} [opts]
 */
export function computeChatMediaLayout(naturalW, naturalH, maxWidth, { isGif = false } = {}) {
  const maxW = Math.max(96, Math.floor(maxWidth));
  const maxH = isGif ? 320 : 480;
  const minW = 96;
  const minH = 64;

  let aspect = 4 / 3;
  if (naturalW > 0 && naturalH > 0) {
    aspect = naturalW / naturalH;
  } else if (isGif) {
    aspect = 16 / 9;
  }

  let w = maxW;
  let h = w / aspect;

  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  if (w < minW) {
    w = minW;
    h = w / aspect;
  }
  if (h < minH) {
    h = minH;
    w = h * aspect;
  }

  return {
    width: Math.round(w),
    height: Math.round(h) };
}
