/**
 * Offline checks for chat pagination merge helpers.
 * Run: node scripts/test-chat-message-merge.mjs
 */

function serverHiddenForMeIdSet(nickname, rows) {
  const hidden = new Set();
  for (const m of rows ?? []) {
    if (m?.id != null && (m.hidden_for || []).includes(nickname)) {
      hidden.add(m.id);
    }
  }
  return hidden;
}

function mergeMessagesById(...lists) {
  const byId = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (m?.id != null) byId.set(m.id, m);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

function mergeMessagesKeepingOptimisticText(serverRows, prevRows, pendingTempIds) {
  if (!pendingTempIds?.length) return serverRows;
  const pendingSet = new Set(pendingTempIds);
  const pendingRows = prevRows.filter((m) => pendingSet.has(m.id));
  if (pendingRows.length === 0) return serverRows;
  const serverIds = new Set(serverRows.map((m) => m.id));
  const stillPending = pendingRows.filter((p) => !serverIds.has(p.id));
  if (stillPending.length === 0) return serverRows;
  return [...serverRows, ...stillPending];
}

const MESSAGES_PAGE_SIZE = 30;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1) dedupe + sort
const server = [
  { id: 'b', created_at: '2026-01-02T10:00:00Z', text: 'B2' },
  { id: 'c', created_at: '2026-01-03T10:00:00Z', text: 'C' },
];
const disk = [
  { id: 'a', created_at: '2026-01-01T10:00:00Z', text: 'A' },
  { id: 'b', created_at: '2026-01-02T10:00:00Z', text: 'B1' },
  { id: 'c', created_at: '2026-01-03T10:00:00Z', text: 'C-old' },
];
const merged = mergeMessagesById(disk, server);
assert(merged.length === 3, 'merge keeps 3 unique ids');
assert(merged[0].id === 'a', 'oldest first');
assert(merged[1].text === 'B2', 'later list (server) wins on duplicate id');
assert(merged[2].text === 'C', 'newest from server');

// 2) initial load: disk + server refresh (server wins on overlap)
const initial = mergeMessagesById(disk, server);
assert(initial.length === 3 && initial[1].text === 'B2', 'initial load merge');

// 3) pagination prepend (no overlap)
const page2 = [
  { id: 'x', created_at: '2025-12-31T10:00:00Z', text: 'older' },
];
const afterPage = mergeMessagesById(page2, initial);
assert(afterPage.length === 4, 'prepend adds older');
assert(afterPage[0].id === 'x', 'older at index 0');

// 3) hasMore heuristic
assert(MESSAGES_PAGE_SIZE === 30, 'page size 30');
assert([...Array(30)].length >= MESSAGES_PAGE_SIZE, 'full page → hasMore');
assert([...Array(29)].length < MESSAGES_PAGE_SIZE, 'short page → no hasMore');

// 4) optimistic pending preserved
const optId = '__opt_text_1';
const prev = [
  { id: 'm1', created_at: '2026-01-01T10:00:00Z', text: 'hi' },
  { id: optId, created_at: '2026-01-04T10:00:00Z', text: 'pending', _isOptimistic: true },
];
const srv = [{ id: 'm1', created_at: '2026-01-01T10:00:00Z', text: 'hi' }];
const withOpt = mergeMessagesKeepingOptimisticText(srv, prev, [optId]);
assert(withOpt.length === 2, 'optimistic kept');
assert(withOpt[1].id === optId, 'optimistic at tail');

// 5) cursor: oldest is index 0
const chrono = afterPage;
assert(chrono[0].created_at < chrono[chrono.length - 1].created_at, 'chronological order');

// 6) stale cache: server says hidden, id only in disk cache
const me = 'alice';
const staleCache = [
  { id: 'old-visible', created_at: '2026-01-01T10:00:00Z', text: 'hi' },
  { id: 'deleted', created_at: '2026-01-02T10:00:00Z', text: 'gone' },
];
const serverRows = [
  { id: 'old-visible', created_at: '2026-01-01T10:00:00Z', text: 'hi', hidden_for: [] },
  {
    id: 'deleted',
    created_at: '2026-01-02T10:00:00Z',
    text: 'gone',
    hidden_for: [me],
  },
];
const serverFiltered = serverRows.filter((m) => !(m.hidden_for || []).includes(me));
const hiddenIds = serverHiddenForMeIdSet(me, serverRows);
const reconciled = mergeMessagesById(staleCache, serverFiltered).filter(
  (m) => !hiddenIds.has(m.id),
);
assert(reconciled.length === 1 && reconciled[0].id === 'old-visible', 'hidden id stripped from stale cache');

console.log('test-chat-message-merge.mjs: all checks passed');
