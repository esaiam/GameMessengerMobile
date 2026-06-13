/** Скорость «печати» ответа Aria: 1.2–10 с на всё сообщение. */
export function resolveAriaTypewriterTickMs(textLength) {
  const len = Math.max(1, Number(textLength) || 0);
  const targetMs = Math.min(10000, Math.max(1200, len * 28));
  return Math.max(10, Math.min(42, Math.round(targetMs / len)));
}

/** Символов за тик — длинные ответы не тормозят UI. */
export function resolveAriaTypewriterChunkSize(textLength) {
  const len = Math.max(1, Number(textLength) || 0);
  if (len > 500) return 4;
  if (len > 200) return 3;
  if (len > 80) return 2;
  return 1;
}
