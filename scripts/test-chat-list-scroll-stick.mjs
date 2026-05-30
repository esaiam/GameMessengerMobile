/**
 * Stick-to-bottom tail detection (step 1.1).
 * Run: node scripts/test-chat-list-scroll-stick.mjs
 */

import {
  shouldStickScrollOnMessagesTailChange,
  canLoadOlderOnEndReached,
} from '../src/components/chat/chatListScrollStick.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tail = { id: 'newest', created_at: '2026-01-03T10:00:00Z' };
const mid = { id: 'mid', created_at: '2026-01-02T10:00:00Z' };
const old = { id: 'oldest', created_at: '2026-01-01T10:00:00Z' };

// новое сообщение в хвост
const page = [old, mid, tail];
const withNew = [old, mid, tail, { id: 'fresh', created_at: '2026-01-04T10:00:00Z' }];
assert(
  shouldStickScrollOnMessagesTailChange(page, withNew) === true,
  'append at tail → scroll',
);

// pagination prepend — хвост тот же
const older = { id: 'x', created_at: '2025-12-31T10:00:00Z' };
const paginated = [older, old, mid, tail];
assert(
  shouldStickScrollOnMessagesTailChange(page, paginated) === false,
  'pagination prepend → no scroll',
);

// read_at / reactions — длина и хвост те же
const readUpdated = page.map((m) => (m.id === 'mid' ? { ...m, read_at: '2026-01-02T11:00:00Z' } : m));
assert(
  shouldStickScrollOnMessagesTailChange(page, readUpdated) === false,
  'metadata update → no scroll',
);

// optimistic reconcile — temp id → server id на хвосте
const opt = [old, mid, { id: '__temp_1', created_at: '2026-01-03T10:00:01Z' }];
const reconciled = [old, mid, { id: 'server-1', created_at: '2026-01-03T10:00:01Z' }];
assert(
  shouldStickScrollOnMessagesTailChange(opt, reconciled) === true,
  'optimistic tail id replace → scroll',
);

// первый load
assert(shouldStickScrollOnMessagesTailChange([], page) === true, 'first load → scroll');
assert(shouldStickScrollOnMessagesTailChange(page, []) === false, 'clear → no scroll');

// onEndReached guard
assert(
  canLoadOlderOnEndReached(400, 800, true) === false,
  'short content → no pagination',
);
assert(
  canLoadOlderOnEndReached(900, 800, false) === false,
  'scrollable but user at bottom → no pagination',
);
assert(
  canLoadOlderOnEndReached(900, 800, true) === true,
  'scrollable + user scrolled up → pagination',
);

console.log('test-chat-list-scroll-stick: ok');
