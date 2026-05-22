import { INVITE_APP_SCHEME } from './inviteDeepLink';

/** Совпадает с redirect в resetPasswordForEmail; добавь в Supabase → Auth → Redirect URLs. */
export const AUTH_RECOVERY_REDIRECT_URL = `${INVITE_APP_SCHEME}://reset-password`;

/**
 * Токены из письма Supabase приходят в hash или в query.
 * @param {string} rawUrl
 * @returns {{ access_token: string, refresh_token: string, type: string } | null}
 */
export function parseAuthRecoveryFromUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const fromSearch = (qs) => {
      if (!qs) return null;
      const p = new URLSearchParams(qs);
      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');
      if (!access_token || !refresh_token) return null;
      return {
        access_token,
        refresh_token,
        type: p.get('type') || '' };
    };
    if (u.hash && u.hash.length > 1) {
      const r = fromSearch(u.hash.slice(1));
      if (r) return r;
    }
    if (u.search && u.search.length > 1) {
      const r = fromSearch(u.search.slice(1));
      if (r) return r;
    }
    return null;
  } catch {
    return null;
  }
}
