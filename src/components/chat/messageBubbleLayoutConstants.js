import { V } from '../../theme';

/** Подсветка строки в режиме выбора (ширина контента ленты); нейтральный серый из токенов */
export const MESSAGE_ROW_SELECTION_BG = V.border;

/** Пузыри: Design.mdc */
export const BUBBLE_RADIUS = 18;
export const BUBBLE_TAIL = 4;
export const MSG_TEXT_SIZE = 16;
export const MSG_LINE_HEIGHT = Math.round(MSG_TEXT_SIZE * 1.45);
export const TS_TEXT_SIZE = 11;
/** Резерв ширины под время+галочки/огонёк (px) — вместо длинной строки NBSP внутри Text. */
export const META_RESERVE_PX_INCOMING = 48;
export const META_RESERVE_PX_OUTGOING = 88;
export const META_RESERVE_PX_EPHEMERAL_EXTRA = 40;

/** Видеокружок в ленте: высота блока (круг + полоса времени поверх низа). */
export const VIDEO_FEED_TIME_OVERLAP_PX = 18;
export const VIDEO_FEED_CIRCLE_IDLE = 200 + VIDEO_FEED_TIME_OVERLAP_PX;
export const VIDEO_FEED_CIRCLE_ACTIVE = Math.round(VIDEO_FEED_CIRCLE_IDLE * (280 / 200));

/** Реакции: оверлей у левого нижнего угла пузыря (как в Telegram). */
export const REACTION_OVERLAY_LEFT = 8;
export const REACTION_OVERLAY_BOTTOM = -8;
/** Запас под строку, когда чипы выступают ниже пузыря */
export const REACTION_OVERLAY_ROW_RESERVE = 12;
