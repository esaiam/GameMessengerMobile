/**
 * @param {string} text
 * @param {string} tag например `@pic` или `@gif`
 * @returns {{ query: string, triggerStart: number } | null}
 */
export function parseAtTrigger(text, tag) {
  if (typeof text !== 'string' || !text.includes(tag)) return null;
  const idx = text.lastIndexOf(tag);
  if (idx < 0) return null;
  if (idx > 0 && !/\s/.test(text[idx - 1])) return null;
  const tail = text.slice(idx + tag.length);
  const query =
    tail.startsWith(' ') || tail.startsWith('\n') ? tail.replace(/^[\s\n]+/, '') : tail;
  return {
    query: query.trim(),
    triggerStart: idx,
  };
}

/** Активен последний из `@pic` / `@gif` в строке. */
export function parseActiveInlineMediaQuery(text) {
  const pic = parseAtTrigger(text, '@pic');
  const gif = parseAtTrigger(text, '@gif');
  if (!pic && !gif) return null;
  if (!pic) return { kind: 'gif', ...gif };
  if (!gif) return { kind: 'pic', ...pic };
  return pic.triggerStart >= gif.triggerStart
    ? { kind: 'pic', ...pic }
    : { kind: 'gif', ...gif };
}
