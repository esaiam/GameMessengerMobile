import { getMessageCopyText } from './getMessageCopyText';

/**
 * Однострочный превью-текст для reply / pinned bar.
 * @param {import('./chatMessageTypes').ChatMessageRow | null | undefined} item
 */
export function getMessagePreviewText(item) {
  if (!item) return '';
  const copy = getMessageCopyText(item);
  const oneLine = copy.replace(/\s+/g, ' ').trim();
  return oneLine || '[Сообщение]';
}
