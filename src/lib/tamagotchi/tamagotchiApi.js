import { ARIA_API_URL, fetchAriaPendingMessages, fetchAriaState, normalizeAriaState } from '../aria';

export {
  DEFAULT_ARIA_STATE,
  normalizeAriaState,
  computeIsSick,
  to01,
  clampBipolar } from '../aria';

export async function fetchPendingMessages(userId) {
  return fetchAriaPendingMessages(userId);
}

export { fetchAriaState };

export class AriaRateLimitError extends Error {
  constructor(retryAfterSec) {
    super('rate_limit');
    this.name = 'AriaRateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

function parseRetryAfter(res) {
  try {
    const header = res.headers?.get?.('Retry-After');
    if (header) {
      const n = parseInt(header, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  return 3;
}

export async function postAriaAction(userId, action) {
  if (!ARIA_API_URL || !userId) throw new Error('no_api');
  const res = await fetch(`${ARIA_API_URL}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, action }) });
  if (res.status === 429) {
    throw new AriaRateLimitError(parseRetryAfter(res));
  }
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) throw new Error(`http_${res.status}`);
  const state = normalizeAriaState(json);
  const inner_thought =
    typeof json?.inner_thought === 'string' ? json.inner_thought.trim() : '';
  return { state, inner_thought };
}
