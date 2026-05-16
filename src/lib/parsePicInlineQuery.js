import { parseAtTrigger } from './parseInlineTrigger';

/**
 * Разбор inline-триггера `@pic` в строке ввода.
 * @returns {{ query: string, triggerStart: number } | null}
 */
export function parsePicInlineQuery(text) {
  return parseAtTrigger(text, '@pic');
}

/** Убирает фрагмент `@pic …` из текста (остаток — подпись). */
export function stripPicInlineTrigger(text) {
  const parsed = parsePicInlineQuery(text);
  if (!parsed) return text;
  return text.slice(0, parsed.triggerStart).trimEnd();
}
