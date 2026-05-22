import { TAB_BAR_LAYOUT } from '../../theme';

/** Reply-плашка над капсулой ввода */
export const REPLY_TARGET_PREVIEW_H = 52;
export const EMOJI_PICKER_PANEL_H = 221;
/** Видимая высота панели над клавиатурой при поиске GIF */
export const EMOJI_GIF_EXPANDED_VISIBLE_H = 248;
/** Островок Эмодзи / GIF в панели */
export const EMOJI_PANEL_ISLAND_H = 34;
/** Строка поиска GIF в панели */
export const EMOJI_PANEL_SEARCH_H = 36;
export const EMOJI_PANEL_SEARCH_RADIUS = 18;
export const EMOJI_PANEL_GIF_COLS = 3;

/** Inline-панель `@pic` над composer */
export const PIC_INLINE_PANEL_H = 200;
export const PIC_INLINE_COLS = 3;

/** Иконки скрепки / микрофона / отправки */
export const INPUT_BAR_ICON = TAB_BAR_LAYOUT.iconSize;
/** Смайлик крупнее иконок вкладок */
export const INPUT_BAR_EMOJI_ICON = TAB_BAR_LAYOUT.iconSize + 5;
/** Сдвиг скрепки и микрофона вправо относительно поля текста */
export const INPUT_BAR_CLIP_MIC_SHIFT = 6;
/** Визуально совпадает с frosted-шапкой (ChatRoomHeader.js) */
export const INPUT_BAR_BLUR_INTENSITY_IOS = 78;
export const INPUT_BAR_BLUR_INTENSITY_ANDROID = 56;
export const INPUT_BAR_FROST_TINT_OPACITY = 0.18;

/** Ширина слота под VoiceRecorder (внешнее кольцо микрофона, см. VoiceRecorder MIC_OUTER) */
export const MIC_BUTTON_SIZE = 47;
/** Внутренний sage-круг микрофона / отправки текста (см. VoiceRecorder MIC_INNER) */
export const MIC_INNER = 40;
/** Глиф на sage-кнопке — как VoiceRecorder MIC_ICON_ON_SAGE */
export const ON_SAGE_GLYPH = '#FFFFFF';

export const EMOJI_SET = [
  '😀','😃','😄','😁','😂','🤣','😊','😇','😉','😍',
  '🥰','😘','😎','🤩','🤔','😏','🙄','😒','😤','😡',
  '🤬','😱','😨','😢','😭','🥺','😴','🤮','🤯','🥳',
  '😈','👍','👎','👋','✌️','🤞','👊','✊','🤝','👏',
  '🙌','💪','🤙','👌','🤘','🫡','❤️','🧡','💛','💚',
  '💙','💜','🖤','💔','💯','💥','🔥','⭐','💫','🎉',
  '🎊','🎮','🎲','🏆','🏅','⚡','💣','💀','👑','💎',
  '🎯','🚀'];
