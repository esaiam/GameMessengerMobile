/**
 * Пропсы режима Aria для ChatComposer (локальный бот).
 *
 * @param {boolean} isAriaChat
 * @param {boolean | undefined} ariaOnline — из шапки; false = недоступен
 * @returns {{ ariaTextOnly: boolean, ariaAllowVoice: boolean, ariaUnavailable: boolean }}
 */
export function getAriaComposerSurfaceProps(isAriaChat, ariaOnline) {
  const aria = !!isAriaChat;
  return {
    ariaTextOnly: aria,
    ariaAllowVoice: aria,
    ariaUnavailable: aria && ariaOnline === false,
  };
}
