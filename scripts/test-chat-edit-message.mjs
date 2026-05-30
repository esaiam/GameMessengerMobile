/**
 * Unit checks for canEditMessage (step 7).
 * Run: node scripts/test-chat-edit-message.mjs
 */
import assert from 'node:assert/strict';
import { canEditMessage } from '../src/components/chat/chatEditMessageUtils.js';

const me = 'alice';

assert.equal(canEditMessage(null, me), false);
assert.equal(canEditMessage({ player_name: 'bob', message_type: 'text', id: 1 }, me), false);
assert.equal(
  canEditMessage({ player_name: me, message_type: 'text', id: 1, _isOptimistic: true }, me),
  false,
);
assert.equal(
  canEditMessage({ player_name: me, message_type: 'image', id: 1 }, me),
  false,
);
assert.equal(
  canEditMessage({ player_name: me, message_type: 'text', id: '__opt_text_1' }, me),
  false,
);
assert.equal(
  canEditMessage({ player_name: me, message_type: 'text', id: 42 }, me, true),
  false,
);
assert.equal(
  canEditMessage({ player_name: me, message_type: 'text', id: 42 }, me),
  true,
);
assert.equal(
  canEditMessage({ player_name: me, id: 42 }, me),
  true,
);

console.log('test-chat-edit-message: ok');
