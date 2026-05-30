/** Вертикальный подъём до закрепления (~1 см в pt на типичном телефоне) */
export const LOCK_COMMIT_UP_PX = 38;
/** Фаза «падение» без пружины — только easing */
export const LOCK_DROP_MS = 200;
export const LOCK_DROP_SETTLE_MS = 170;
/** Отмена при сдвиге влево ≥ этой доли от maxSlideX (maxSlideX ≈ ширина капсулы / 3) */
export const CANCEL_SLIDE_RATIO = 0.88;
/** После этого смещения (px) выбирается «рельс»: только влево или только вверх */
export const RAIL_LOCK_PX = 14;
export const SPRING_RAIL_RETURN = { damping: 18, stiffness: 280 } as const;
/** padding between depth-ring and SafeBlurView */
export const DEPTH = 0;
/** Визуальный спек микрофона в инпут-баре (−10% к прежним 44 / 52) */
export const MIC_INNER = 40;
export const MIC_OUTER = 47;
/** Кружок под плавающие Lock / Pause над микрофоном */
export const FLOAT_ICON_CIRCLE = 36;
export const MIC_ICON_SPEC = 18;
/** Как кнопка play в VoiceMessagePlayer (белый глиф на sage) */
export const MIC_ICON_ON_SAGE = '#FFFFFF';
/** Масштаб кнопки при активной записи (меньше, чем «полный» ×3) */
export const RECORD_LIFT = 2;
/** Сдвиг замка вверх при увеличении кнопки */
export const LOCK_FLOAT_EXTRA = Math.round((MIC_OUTER * (RECORD_LIFT - 1)) / 2);
/** Тонкое свечение чуть больше внутреннего круга (только край) */
export const EDGE_GLOW_SIZE = MIC_INNER + 6;
/** Выше overlay внутри VideoRecorder (zIndex 201), чтобы кнопка не уходила под превью */
export const MIC_VIDEO_FRONT_Z = 250;
export const BAR_COUNT = 40;
/** Ручки обрезки голоса (предпросмотр) */
export const TRIM_HANDLE_W = 10;
export const TRIM_HANDLE_H = 34;
export const TRIM_MIN_SPAN = 0.06;
/** Короче — тихий discard (случайный tap). */
export const MIN_RECORDING_SEC = 1;
