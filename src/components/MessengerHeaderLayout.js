import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MESSENGER_HEADER_CONTENT_MIN_HEIGHT = 42;
export const MESSENGER_HEADER_PADDING_TOP_OFFSET = 10;
export const MESSENGER_HEADER_PADDING_BOTTOM = 8;
export const MESSENGER_HEADER_PADDING_HORIZONTAL = 16;

export function getMessengerHeaderLayout(insetsTop, topPaddingOverride) {
  const paddingTop =
    typeof topPaddingOverride === 'number' ? topPaddingOverride : (insetsTop || 0) + MESSENGER_HEADER_PADDING_TOP_OFFSET;

  const minHeight = paddingTop + MESSENGER_HEADER_CONTENT_MIN_HEIGHT + MESSENGER_HEADER_PADDING_BOTTOM;

  return {
    paddingTop,
    paddingBottom: MESSENGER_HEADER_PADDING_BOTTOM,
    paddingHorizontal: MESSENGER_HEADER_PADDING_HORIZONTAL,
    contentMinHeight: MESSENGER_HEADER_CONTENT_MIN_HEIGHT,
    minHeight };
}

/**
 * Единый layout шапок мессенджера: тот же вертикальный ритм, что у ChatRoomHeader.
 * Возвращает готовый `containerStyle` (padding + minHeight) и рассчитанные значения.
 */
export function useMessengerHeaderLayout({ topPaddingOverride } = {}) {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const layout = getMessengerHeaderLayout(insets.top, topPaddingOverride);
    return {
      ...layout,
      /** Продление blur/фона шапки вверх (status bar), контент не смещается */
      blurExtendTop: insets.top || 0,
      containerStyle: {
        paddingTop: layout.paddingTop,
        paddingBottom: layout.paddingBottom,
        paddingHorizontal: layout.paddingHorizontal,
        minHeight: layout.minHeight } };
  }, [insets.top, topPaddingOverride]);
}

