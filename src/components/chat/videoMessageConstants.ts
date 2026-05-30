import {
  VIDEO_FEED_CIRCLE_IDLE,
  VIDEO_FEED_CIRCLE_ACTIVE,
} from './messageBubbleLayoutConstants';

export const IDLE_WARMUP_TEXTURE = require('../../../assets/chat-room-wallpaper.jpg');

export const CIRCLE_IDLE = VIDEO_FEED_CIRCLE_IDLE;
export const CIRCLE_ACTIVE = VIDEO_FEED_CIRCLE_ACTIVE;
export const R_IDLE = CIRCLE_IDLE / 2;
export const R_ACTIVE = CIRCLE_ACTIVE / 2;

/** Свежий локальный mp4 часто шлёт ложный playToEnd до стабильной длительности — не закрываем UI сразу после старта. */
export const PLAY_TO_END_GRACE_MS = 550;

export const MEANINGFUL_PROGRESS = { minDur: 0.06, minTime: 0.012 } as const;

/** Кольцо прогресса в viewBox 0…100 — центр линии на краю видеокруга. */
export const RING_C = 50;
export const RING_STROKE = 1.75;
export const RING_R = RING_C - RING_STROKE / 2;
export const KNOB_R = 3.25;
/** Центр knob снаружи диска — не пересекается с маской видео. */
export const KNOB_ORBIT_R = RING_R + KNOB_R * 0.55;
export const RING_CIRC = 2 * Math.PI * RING_R;
export const RING_TRACK = 'rgba(255,255,255,0.16)';
export const RING_HIT_INNER_RATIO = 0.72;
export const SCRUB_SEEK_INTERVAL_MS = 120;
