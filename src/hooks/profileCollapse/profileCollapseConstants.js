/** Layout, animation ramps и snap-пороги collapse header профиля. */
import { CHAT_HEADER_AVATAR_SIZE } from '../../components/ChatRoomHeader';

export const PROFILE_AVATAR_SIZE = 96;
export const AVATAR_MARGIN_TOP = -12;
export const NAME_MARGIN_TOP = 14;
export const ACTIONS_MARGIN_TOP = 20;
/** Зазор от низа шапки до верха ряда кнопок (профиль контакта) */
export const HEADER_TO_ACTIONS_TOP_GAP = 16;
export const SCROLL_CONTENT_LIFT = 36;
/** Зазор медиа под шапкой в свёрнутом состоянии */
export const SCROLL_CONTENT_GAP_BELOW_HEADER = 16;
/** Профиль контакта: зазор между статусом сети и началом скролла (до sectionSpacer) */
export const CONTACT_PROFILE_MEDIA_GAP_BELOW_STATUS = 12;
export const ACTION_ROW_HEIGHT = 52;
export const PROFILE_COLLAPSE_DISTANCE = 132;
/** Пик золотого свечения аватара (px скролла); затем fade до PROFILE_COLLAPSE_DISTANCE */
export const AVATAR_GLOW_SCROLL_PEAK = 80;
export const AVATAR_BORDER_SAGE = 'rgba(90,158,154,0.6)';
export const AVATAR_BORDER_SAGE_PEAK = 'rgba(90,158,154,0.9)';
export const NAME_LINE_HEIGHT = 22;
/** Дуга имени (профиль контакта), px скролла */
export const NAME_ARC_SCROLL_END = 70;
export const NAME_FADE_SCROLL_START = 50;
export const NAME_HIDDEN_SCROLL_START = 70;
export const NAME_HEADER_SCROLL_START = 95;
export const NAME_HEADER_SCROLL_END = 120;
/** Пик подсветки — середина фазы подхода/захода под шапку (после parallax → до полного collapse). */
export const AVATAR_GLOW_HEADER_PEAK_SCROLL =
  (AVATAR_GLOW_SCROLL_PEAK + PROFILE_COLLAPSE_DISTANCE) / 2;
export const AVATAR_GLOW_RING_RAMP = [
  0,
  28,
  AVATAR_GLOW_HEADER_PEAK_SCROLL,
  PROFILE_COLLAPSE_DISTANCE,
];
export const AVATAR_GLOW_RING_OPACITY_RAMP = [0, 0.4, 0.88, 0];
export const AVATAR_GLOW_RING_SCALE_RAMP = [1, 1.05, 1.1, 1.02];
export const AVATAR_GLOW_FILL_MAX = 0.78;
/** Fade-in имени в шапке на 10ms позже (≈ scroll-lag при ~100ms прохода зоны) */
export const NAME_HEADER_OPACITY_DELAY_MS = 10;
export const NAME_HEADER_OPACITY_SCROLL_LAG =
  (NAME_HEADER_OPACITY_DELAY_MS / 100) *
  (NAME_HEADER_SCROLL_END - NAME_HEADER_SCROLL_START);
export const NAME_ARC_RADIUS = 60;
/** Якорь имени под аватаром → смещение от центра орбиты (низ круга = старт) */
export const NAME_ORBIT_BELOW_CENTER = PROFILE_AVATAR_SIZE / 2 + NAME_MARGIN_TOP;
export const HEADER_MINI_AVATAR_SIZE = CHAT_HEADER_AVATAR_SIZE;
export const HEADER_MINI_AVATAR_GAP = 8;
export const HEADER_BACK_SLOT_W = 40;
/** Как ChatRoomHeader: back marginLeft −10, marginRight 1; avatar marginLeft 8 */
export const CHAT_HEADER_BACK_MARGIN_LEFT = -10;
export const CHAT_HEADER_BACK_MARGIN_RIGHT = 1;
export const CHAT_HEADER_AVATAR_MARGIN_LEFT = 8;
/** Позиция статуса в шапке — как ChatRoomHeader (не трогает layout нижнего статуса) */
export const CHAT_HEADER_NAME_LINE_HEIGHT = 20;
export const CHAT_HEADER_STATUS_GAP = (2 * 2) / 3;
export const HEADER_UNDER_GLOW_HEIGHT = 32;
/** Сдвиг вверх: яркий край градиента под непрозрачной шапкой */
export const HEADER_UNDER_GLOW_LIFT_UP = 20;
export const PROFILE_CHROME_Z_BELOW_FLOAT = 8;
/** Имя поверх шапки на всей дуге collapse */
export const NAME_ABOVE_HEADER_Z = 12;
export const STATUS_MARGIN_TOP = 6;
export const STATUS_LINE_HEIGHT = 13;
/** Пороги snap: верх слабее, низ сильнее (позиция y, не dragStart). */
export const SNAP_EXPAND_THRESHOLD = 0.46;
export const SNAP_COLLAPSE_THRESHOLD = 0.33;
/** Нейтральное отпускание: ниже этой доли collapse → вниз (bias к collapsed). */
export const SNAP_REST_MIDPOINT = 0.42;
export const COLLAPSE_SNAP_ZONE_EXTRA = 10;
/** Раскрытие (y→0): мягче, меньше «магнита» сверху */
export const SNAP_SPRING_EXPAND = { damping: 32, stiffness: 148, mass: 1.05 };
/** Сворачивание (y→collapse): тугая, без отскока снизу */
export const SNAP_SPRING_COLLAPSE = { damping: 34, stiffness: 590, mass: 0.54 };
export const SNAP_VELOCITY_EXPAND = 0.42;
export const SNAP_VELOCITY_COLLAPSE = 0.32;
export const SNAP_DRAG_MIN_PX = 8;
/** Кнопки над аватаром (профиль контакта): быстрее аватара уходят под шапку. */
export const ACTIONS_PARALLAX_SLOW = 1.15;
export const ACTIONS_PARALLAX_FAST = 3.85;
export const ACTIONS_LIFT_SPEED = 1.85;
