import { parseAtTrigger } from './parseInlineTrigger';

/** Разбор `@gif` в строке ввода. */
export function parseGifInlineQuery(text) {
  return parseAtTrigger(text, '@gif');
}

export function stripGifInlineTrigger(text) {
  const parsed = parseGifInlineQuery(text);
  if (!parsed) return text;
  return text.slice(0, parsed.triggerStart).trimEnd();
}
