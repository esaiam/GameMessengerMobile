export function deterministicRoomId(userId1, userId2) {
  const a = String(userId1 || '').trim();
  const b = String(userId2 || '').trim();
  if (!a || !b) throw new Error('deterministicRoomId: both user ids required');
  const [u1, u2] = [a, b].sort();
  return `room_${u1}_${u2}`;
}

export function normalizeUserPair(userId1, userId2) {
  const a = String(userId1 || '').trim();
  const b = String(userId2 || '').trim();
  if (!a || !b) throw new Error('normalizeUserPair: both user ids required');
  const [u1, u2] = [a, b].sort();
  return { user1Id: u1, user2Id: u2, roomId: `room_${u1}_${u2}` };
}

