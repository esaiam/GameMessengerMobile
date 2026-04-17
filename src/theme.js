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
  /** Входящий пузырь — бирюзово-сланцевый */
  inBubbleBg: '#173836',
  /** Вертикальный градиент входящего пузыря (Skia), стопы сверху вниз */
  inBubbleGradient: ['#0F181A', '#173836', '#1E4542'],
  /** Вертикальный градиент исходящего пузыря (Skia) */
  outBubbleGradient: ['#153532', '#1E3F3D', '#265A56'],
  /** Текст в исходящем пузыре (Design.mdc) */
  outBubbleText: '#E8E4DA',
  /** Текст во входящем пузыре (Design.mdc) */
  inBubbleText: '#B8B4AC',
  gameBubbleBg: '#2A2415',
  gameCardBg: '#0F2020',

  btnPrimaryBg: '#1A2E2E',
  btnPrimaryHover: '#1F3535',

  sageBorder: 'rgba(90,158,154,0.2)',
  sageFocus: 'rgba(90,158,154,0.4)',
  sageSubtle: 'rgba(90,158,154,0.04)',
  hoverBg: 'rgba(255,255,255,0.02)',
  sectionBorder: 'rgba(255,255,255,0.04)',

  dangerMuted: '#B56B6B',
};

/**
 * Геометрия «парящего» таб-бара (`GlassTabBar`).
 * Плашка ввода в чате использует те же отступы от краёв экрана и размеры ряда иконок.
 */
export const TAB_BAR_LAYOUT = {
  horizontalPad: 14,
  floatBottom: 10,
  topPad: 8,
  rowPaddingH: 8,
  rowPaddingV: 12,
  iconSize: 22,
  borderRadius: 22,
};

/** Высота внутреннего ряда таб-бара: вертикальные отступы + размер иконки */
export const TAB_BAR_INNER_ROW_H =
  TAB_BAR_LAYOUT.rowPaddingV * 2 + TAB_BAR_LAYOUT.iconSize;

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
