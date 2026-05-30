/**
 * Formatted row cache signature (step 1.2).
 * Run: node scripts/test-chat-message-format.mjs
 */

import {
  messageRowContentSig,
  buildFormattedRowCached,
} from '../src/components/chat/chatMessageListFormat.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const base = {
  id: 'm1',
  created_at: '2026-01-02T10:00:00Z',
  player_name: 'alice',
  text: 'hello',
  message_type: 'text',
};

const sig0 = messageRowContentSig(base);

// edit: edited_at без смены текста (гипотетический server-only patch)
const editedOnly = { ...base, edited_at: '2026-01-02T10:05:00Z' };
assert(
  messageRowContentSig(editedOnly) !== sig0,
  'edited_at alone invalidates sig',
);

// optimistic → confirmed
const optimistic = { ...base, _isOptimistic: true };
const confirmed = { ...base, _isOptimistic: false };
assert(
  messageRowContentSig(optimistic) !== messageRowContentSig(confirmed),
  '_isOptimistic change invalidates sig',
);

// cache row rebuild on edit
const cache = new Map();
const row1 = buildFormattedRowCached(base, null, cache);
const row2 = buildFormattedRowCached(editedOnly, null, cache);
assert(row1 !== row2, 'buildFormattedRowCached returns new row after edit sig change');
assert(row2.edited_at === editedOnly.edited_at, 'edited_at on formatted row');

// read_at still invalidates (regression)
const read = { ...base, read_at: '2026-01-02T10:01:00Z' };
assert(messageRowContentSig(read) !== sig0, 'read_at invalidates sig');

console.log('test-chat-message-format: ok');
