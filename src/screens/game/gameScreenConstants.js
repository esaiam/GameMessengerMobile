export { NICKNAME_STORAGE_KEY as NICKNAME_KEY } from '../../lib/nicknameStorage';
export const SWIPE_HINT_KEY = '@vault_swipe_hint_seen';
export const LEGACY_SWIPE_HINT_KEY = '@backgammon_swipe_hint_seen';

export const BOARD_TOP_GAP = 4;
export const BOARD_SIDE_GAP = 8;
/** Зазор между низом острова и верхом ввода чата (см. useGameIslandAnimation). */
export const ISLAND_BOTTOM_GAP = 108;
/** Высота нижней секции island (collapsed pill). */
export const ISLAND_COLLAPSED_H = 36;
/** Планшет: минимальный зазор до композера — меньше = выше доска. */
export const TABLET_MIN_BOTTOM_GAP = 12;
/** Ширина игрового острова на планшете — как типичный телефон. */
export const PHONE_GAME_ISLAND_W = 390;
export const DEFAULT_PH = 130;
export const MIN_PH = 50;
export const BOARD_CHROME = 32;
/**
 * Планшет: единственная ручка высоты доски (pointH).
 * TABLET_BOARD_MAX_H пересчитывается автоматически — не трогать вручную.
 */
export const TABLET_POINT_H_MAX = 220;
export const TABLET_BOARD_MAX_H = TABLET_POINT_H_MAX * 2 + BOARD_CHROME;

/**
 * Планшет: board-area острова — целевая высота TABLET_BOARD_MAX_H,
 * при нехватке места сжимаем gap (до 8px), а не игнорируем константу.
 */
export function computeTabletBoardAreaH(boardColTopY, inputTopY, targetBoardH = TABLET_BOARD_MAX_H) {
  const desired = Math.max(200, targetBoardH);
  if (typeof boardColTopY !== 'number' || typeof inputTopY !== 'number' || inputTopY <= boardColTopY) {
    return desired;
  }
  const maxSlack = inputTopY - boardColTopY - ISLAND_COLLAPSED_H - TABLET_MIN_BOTTOM_GAP;
  if (desired <= maxSlack) return desired;
  const tightGap = Math.max(8, inputTopY - boardColTopY - ISLAND_COLLAPSED_H - desired);
  return Math.max(200, Math.min(desired, inputTopY - boardColTopY - ISLAND_COLLAPSED_H - tightGap));
}

/** Планшет: pointH из board-area (или TABLET_POINT_H_MAX если measure ещё нет). */
export function tabletPointHFromBoardArea(boardAreaH) {
  if (typeof boardAreaH !== 'number' || boardAreaH <= 0) {
    return TABLET_POINT_H_MAX;
  }
  return Math.min(
    TABLET_POINT_H_MAX,
    Math.max(MIN_PH, Math.floor((boardAreaH - BOARD_CHROME) / 2)),
  );
}

export const DRAG_MAX_EXTRA_H = 28;
export const HANDLE_NARROW_RATIO = 0.6;
export const THUMB_W_MAX = 48;
export const THUMB_W_MIN = 4;
export const THUMB_H_LINE = 4;
