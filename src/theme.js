export const V = {
  bgApp: '#0D0F14',
  bgSurface: '#1A1D24',
  bgElevated: '#252A35',
  border: 'rgba(255,255,255,0.06)',

  accentSage: '#5A9E9A',
  accentGold: '#C9A84C',

  textPrimary: '#E8E4DA',
  textSecondary: '#9E9789',
  textMuted: '#5A5750',
  textGhost: '#3E3D39',

  /** Исходящий пузырь — тёмная бирюза (тон accentSage) */
  outBubbleBg: '#1E3F3D',
  /** Входящий пузырь — нейтральный серый (как bgElevated), без градиента */
  inBubbleBg: '#252A35',
  /** Вертикальный градиент исходящего пузыря (LinearGradient) */
  outBubbleGradient: ['#153532', '#1E3F3D', '#265A56'],
  /** Текст в исходящем пузыре (Design.mdc) */
  outBubbleText: '#E8E4DA',
  /** Текст во входящем пузыре (тело сообщения — см. V.textPrimary в MessageRow) */
  inBubbleText: '#E8E4DA',
  gameBubbleBg: '#2A2415',
  gameCardBg: '#0F2020',

  btnPrimaryBg: '#1A2E2E',
  btnPrimaryHover: '#1F3535',

  sageBorder: 'rgba(90,158,154,0.2)',
  sageFocus: 'rgba(90,158,154,0.4)',
  sageSubtle: 'rgba(90,158,154,0.04)',
  hoverBg: 'rgba(255,255,255,0.02)',
  sectionBorder: 'rgba(255,255,255,0.04)',

  /** Стеклянная капсула (поиск): градиент обводки, свет сверху-слева */
  glassCapsuleEdgeTL: 'rgba(255,255,255,0.22)',
  glassCapsuleEdgeBR: 'rgba(255,255,255,0.07)',
  /** Лёгкая внутренняя подсветка верхнего края */
  glassCapsuleInnerSheen: 'rgba(255,255,255,0.10)',
  /** Нейтральный фон стеклянного элемента (без sage-тинта) */
  glassNeutralBg: 'rgba(255,255,255,0.055)',

  dangerMuted: '#B56B6B',
};

/** Низ градиента затемнения ленты над композером (95%, rgb совпадает с `V.bgApp`). */
export const chatListBottomFadeBottom = 'rgba(13, 15, 20, 0.95)';

/**
 * Геометрия «парящего» таб-бара (`GlassTabBar`).
 * Плашка ввода в чате (`ChatComposer`) по горизонтали и размеру иконок согласована с `TAB_BAR_LAYOUT`, не с полями поиска.
 */
export const TAB_BAR_LAYOUT = {
  horizontalPad: 14,
  floatBottom: 4,
  topPad: 8,
  rowPaddingH: 8,
  rowPaddingV: 17,
  iconSize: 22,
};

/** Высота внутреннего ряда таб-бара: вертикальные отступы + размер иконки */
export const TAB_BAR_INNER_ROW_H =
  TAB_BAR_LAYOUT.rowPaddingV * 2 + TAB_BAR_LAYOUT.iconSize;

/** Pill: скругление капсулы таббара и элементов той же высоты */
export const TAB_BAR_CAPSULE_RADIUS = TAB_BAR_INNER_ROW_H / 2;

/**
 * Капсулы поиска (список чатов, контакты) — отдельные размеры, не от `TAB_BAR_INNER_ROW_H`.
 */
export const SEARCH_FIELD_LAYOUT = {
  chatsHeight: 44,
  contactsRowHeight: 44,
  rowPaddingH: 8,
};

export const SEARCH_CHATS_CAPSULE_RADIUS = SEARCH_FIELD_LAYOUT.chatsHeight / 2;
export const SEARCH_CONTACTS_CAPSULE_RADIUS = SEARCH_FIELD_LAYOUT.contactsRowHeight / 2;

/** Капсула ввода сообщений (`ChatComposer`) — высота не совпадает с таббаром */
export const COMPOSER_LAYOUT = {
  innerHeight: 44,
};

export const COMPOSER_CAPSULE_RADIUS = COMPOSER_LAYOUT.innerHeight / 2;

/** Поле нард: графит / серый в духе основного UI (Vault) */
export const boardPalette = {
  bg: '#1A2030',
  triangleDark: '#2B313D',
  triangleLight: '#3D4654',
  bar: '#252A35',
  divider: '#0D0F14',
  checkerLight: '#E8E4DA',
  checkerLightBorder: '#9E9789',
  checkerDark: '#14171D',
  checkerDarkBorder: '#5A5750',
  handle: '#252A35',
  handlePressed: '#323848',
};
