import { V } from '../../theme';

/** Подсветка строки в режиме выбора (ширина контента ленты); нейтральный серый из токенов */
export const MESSAGE_ROW_SELECTION_BG = V.border;

/** Пузыри: Design.mdc */
export const BUBBLE_RADIUS = 18;
export const BUBBLE_TAIL = 4;
export const MSG_TEXT_SIZE = 15;
export const MSG_LINE_HEIGHT = Math.round(MSG_TEXT_SIZE * 1.45);
export const TS_TEXT_SIZE = 11;
/** Резерв ширины под время+галочки/огонёк (px) — вместо длинной строки NBSP внутри Text. */
export const META_RESERVE_PX_INCOMING = 48;
export const META_RESERVE_PX_OUTGOING = 88;
export const META_RESERVE_PX_EPHEMERAL_EXTRA = 40;
