import { TAB_BAR_LAYOUT, COMPOSER_LAYOUT } from '../../theme';
import { MIC_BUTTON_SIZE } from './chatComposerConstants';

/** Макс. число видео в DOM одновременно (остальные по unlock). */
export const MAX_RENDERED_VIDEOS = 5;

/** Расстояние до низа inverted-ленты, ниже которого считаем «у низа» (как в Telegram). */
export const CHAT_AT_BOTTOM_THRESHOLD_PX = 40;

/** Зазор между низом парящей шапки и первой строкой ленты. */
export const CHAT_HEADER_TO_LIST_GAP_PX = 8;

/** Стартовая оценка высоты композера до onLayout — чтобы bottom-spacer не был 0 при первом scroll. */
export function estimateComposerStackHeight(insets) {
  const paddingBottom = Math.max(
    insets.bottom,
    Math.max(insets.bottom, 10) + TAB_BAR_LAYOUT.floatBottom - 8,
  );
  return (
    TAB_BAR_LAYOUT.topPad +
    Math.max(COMPOSER_LAYOUT.innerHeight, MIC_BUTTON_SIZE) +
    paddingBottom
  );
}
