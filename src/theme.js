export const V = {
  bgApp: '#0D0F14',
  /** Фон экрана списка чатов (Aurora Glass) */
  bgChatsScreen: '#080c14',
  bgSurface: '#1A1D24',
  bgElevated: '#252A35',
  border: 'rgba(255,255,255,0.06)',

  accentSage: '#5A9E9A',
  /** Круг play/pause на голосовом (темнее accentSage, в тон исходящему пузырю) */
  voicePlayBtnBg: '#37736E',
  accentGold: '#C9A84C',

  textPrimary: '#E8E4DA',
  textSecondary: '#9E9789',
  textMuted: '#5A5750',
  textGhost: '#3E3D39',

  /** Входящий пузырь — полупрозрачный нейтральный (legacy, картинки) */
  inBubbleBg: 'rgba(255,255,255,0.07)',
  /** Градиент входящего пузыря (neumorphism, TL → BR; лёгкая прозрачность) */
  inBubbleFillTL: 'rgba(48, 55, 66, 0.75)',
  inBubbleFillBR: 'rgba(22, 25, 31, 0.88)',
  /** Исходящий пузырь — sage с прозрачностью */
  outBubbleBg: 'rgba(72,130,126,0.85)',
  /** Обводка текстовых пузырей */
  bubbleStroke: 'rgba(255,255,255,0.12)',
  /** Текст во входящем пузыре */
  inBubbleText: 'rgba(255,255,255,0.85)',
  /** Текст в исходящем пузыре */
  outBubbleText: 'rgba(255,255,255,0.95)',
  /** Время во входящем пузыре */
  inBubbleTime: 'rgba(255,255,255,0.35)',
  /** Время в исходящем пузыре */
  outBubbleTime: 'rgba(255,255,255,0.5)',
  gameBubbleBg: '#2A2415',
  gameCardBg: '#0F2020',

  btnPrimaryBg: '#1A2E2E',
  btnPrimaryHover: '#1F3535',

  sageBorder: 'rgba(90,158,154,0.2)',
  /** Подпись SECURE SPACE, кольца аватаров в списках */
  sageMuted: 'rgba(90,158,154,0.6)',
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

  /** Тонкая белая обводка капсулы таб-бара */
  tabBarShellBorder: 'rgba(255,255,255,0.14)',
  /** Тинт таб-бара: тёмный серый, почти чёрный (поверх blur) */
  tabBarGlassTintBg: 'rgba(16, 18, 24, 0.88)',

  dangerMuted: '#B56B6B',

  /** Пустой аватар (списки, профиль, шапка чата) — непрозрачные эквиваленты rgba на bgChatsScreen */
  vaultAvatarFill: '#171B22',
  vaultAvatarInitial: '#A2A4A7',
  vaultAvatarBorder: '#262930' };

/** Низ градиента затемнения ленты над композером (95%, rgb совпадает с `V.bgApp`). */
export const chatListBottomFadeBottom = 'rgba(13, 15, 20, 0.95)';

/** Вертикальный overscroll на экранах вкладок (iOS bounce; Android — `useAndroidTabOverscroll`). */
export const TAB_OVERSCROLL_PROPS = {
  bounces: true,
  alwaysBounceVertical: true,
  overScrollMode: 'always',
};

/** Без bounce — экран нард (`GameScreen` / лента чата в комнате игры). */
export const GAME_NO_OVERSCROLL_PROPS = {
  bounces: false,
  alwaysBounceVertical: false,
  overScrollMode: 'never',
};

/**
 * Геометрия «парящего» таб-бара (`GlassTabBar`).
 * Плашка ввода в чате (`ChatComposer`) по горизонтали и размеру иконок согласована с `TAB_BAR_LAYOUT`, не с полями поиска.
 */
export const TAB_BAR_LAYOUT = {
  horizontalPad: 14,
  /** Доп. отступ капсулы таб-бара от краёв экрана с каждой стороны (к `GlassTabBar` formula). */
  screenSideInsetExtra: 16,
  floatBottom: 4,
  /** Зазор между нижней гранью капсулы таб-бара и низом экрана (`GlassTabBar`). */
  screenBottomGap: 8,
  topPad: 8,
  /** Высота стеклянной капсулы таб-бара (`GlassTabBar` / `SafeBlurView`). */
  shellHeight: 52,
  rowPaddingH: 8,
  rowPaddingV: 15,
  iconSize: 22,
  topCornerRadius: 32,
  bottomCornerRadius: 32,
  /** Круг подсветки активной вкладки (чуть меньше высоты ряда). */
  activeHighlightSize: 44 };

/** Высота капсулы таб-бара (совпадает с `shellHeight`). */
export const TAB_BAR_INNER_ROW_H = TAB_BAR_LAYOUT.shellHeight;

/** Pill: скругление капсулы таббара и элементов той же высоты */
export const TAB_BAR_CAPSULE_RADIUS = TAB_BAR_INNER_ROW_H / 2;

/**
 * Капсулы поиска (список чатов, контакты) — отдельные размеры, не от `TAB_BAR_INNER_ROW_H`.
 */
export const SEARCH_FIELD_LAYOUT = {
  chatsHeight: 44,
  contactsRowHeight: 44,
  rowPaddingH: 8 };

export const SEARCH_CHATS_CAPSULE_RADIUS = SEARCH_FIELD_LAYOUT.chatsHeight / 2;
export const SEARCH_CONTACTS_CAPSULE_RADIUS = SEARCH_FIELD_LAYOUT.contactsRowHeight / 2;

/** Капсула ввода сообщений (`ChatComposer`) — высота не совпадает с таббаром */
export const COMPOSER_LAYOUT = {
  innerHeight: 44 };

export const COMPOSER_CAPSULE_RADIUS = 24;

/** Поле нард: Muted Bronze — тёплый премиум-стол в духе gold/cream UI */
export const boardPalette = {
  bg: '#2E2822',
  triangleDark: '#4D463C',
  triangleLight: '#655C4E',
  bar: '#3C3530',
  divider: '#1F1B16',
  checkerLight: '#E8E4DA',
  checkerLightBorder: '#9E9789',
  checkerDark: '#1A1E26',
  checkerDarkBorder: '#6A6560',
  /** Hairline вокруг поля на тёмном Game Island */
  rim: 'rgba(201, 168, 76, 0.16)',
  handle: '#252A35',
  handlePressed: '#323848' };
