import { ARIA_CONTACT } from '../../lib/aria';
import { ARIA_CHAT_LIST_ITEM } from './chatsConstants';

export function filterChatsRows(rows, q) {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) => (r.contactName || '').toLowerCase().includes(s));
}

export function buildChatsListData(q, filtered) {
  const s = q.trim().toLowerCase();
  const ariaNeedle = `${ARIA_CONTACT.display_name} ${ARIA_CONTACT.handle}`.toLowerCase();
  const includeAria =
    !s ||
    ariaNeedle.includes(s) ||
    s.includes('aria') ||
    s.includes('ария') ||
    s === 'ai';
  if (!includeAria) return filtered;
  return [ARIA_CHAT_LIST_ITEM, ...filtered];
}
