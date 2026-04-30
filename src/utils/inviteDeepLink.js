import { normalizePendingInviteCode } from './inviteRedeem';

/**
 * Должен совпадать с expo.scheme в app.json (deep link / QR).
 * Payload в QR: `vaultmessenger://invite?code=<канонический code>` (как в invite_codes после триггера).
 */
export const INVITE_APP_SCHEME = 'vaultmessenger';

export function buildInviteQrPayload(code) {
  const c = normalizePendingInviteCode(code);
  if (!c) return '';
  return `${INVITE_APP_SCHEME}://invite?code=${encodeURIComponent(c)}`;
}

/**
 * Из строки QR: URI с query code= или сырой код (lower/trim).
 */
export function parseInviteQrPayload(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  const schemePrefix = `${INVITE_APP_SCHEME}://`;
  if (s.toLowerCase().startsWith(schemePrefix)) {
    try {
      const u = new URL(s);
      const q = u.searchParams.get('code');
      return normalizePendingInviteCode(q || '');
    } catch {
      const m = s.match(/[?&]code=([^&]+)/i);
      if (m && m[1]) {
        try {
          return normalizePendingInviteCode(decodeURIComponent(m[1]));
        } catch {
          return normalizePendingInviteCode(m[1]);
        }
      }
      return '';
    }
  }

  return normalizePendingInviteCode(s);
}
