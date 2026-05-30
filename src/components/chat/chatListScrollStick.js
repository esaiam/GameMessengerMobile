/**
 * Нужен ли stick-to-bottom scroll: только смена хронологического хвоста (новое / optimistic reconcile).
 * Pagination prepend (длина ↑, tail id тот же) и metadata UPDATE (read_at, reactions) — false.
 *
 * @param {import('./chatMessageTypes').ChatMessageRow[]|null|undefined} prevMessages
 * @param {import('./chatMessageTypes').ChatMessageRow[]|null|undefined} nextMessages
 */
export function shouldStickScrollOnMessagesTailChange(prevMessages, nextMessages) {
  const prevLen = prevMessages?.length ?? 0;
  const nextLen = nextMessages?.length ?? 0;
  if (nextLen === 0) return false;
  if (prevLen === 0) return true;

  const prevTailId = prevMessages[prevLen - 1]?.id ?? null;
  const nextTailId = nextMessages[nextLen - 1]?.id ?? null;
  return nextTailId !== prevTailId;
}

/** Лента выше viewport — иначе inverted onEndReached стреляет при открытии короткого чата. */
export const CHAT_LIST_SCROLLABLE_EPS_PX = 8;

/**
 * @param {number} contentH
 * @param {number} layoutH
 * @param {boolean} userScrolledToHistory — inverted offset y > порога «у низа»
 */
export function canLoadOlderOnEndReached(contentH, layoutH, userScrolledToHistory) {
  if (layoutH <= 0 || contentH <= 0) return false;
  if (contentH <= layoutH + CHAT_LIST_SCROLLABLE_EPS_PX) return false;
  return userScrolledToHistory;
}
