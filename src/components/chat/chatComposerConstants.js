import { TAB_BAR_LAYOUT } from '../../theme';

/** Reply-плашка над капсулой ввода */
export const REPLY_TARGET_PREVIEW_H = 52;
export const EMOJI_PICKER_PANEL_H = 221;

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
  '🎯','🚀',
];
