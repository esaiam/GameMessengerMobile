import { supabase } from '../lib/supabase';

/** Один ключ: JSON { e: email, c: код } — redeem только если email сессии совпадает с e. */
export const VAULT_PENDING_INVITE_KEY = '@vault_pending_invite_code';

export function normalizePendingInviteCode(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function serializePendingInvite(email, code) {
  return JSON.stringify({
    e: String(email || '').trim().toLowerCase(),
    c: normalizePendingInviteCode(code),
  });
}

export function parsePendingInvite(raw) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.c !== 'string') return null;
    const c = normalizePendingInviteCode(o.c);
    const e = String(o.e || '').trim().toLowerCase();
    if (!c || !e) return null;
    return { email: e, code: c };
  } catch {
    return null;
  }
}

/**
 * Вызов RPC redeem_invite_code.
 * Возвращает { ok, errorReason } или transportError при сетевой/PostgREST ошибке.
 */
export async function callRedeemInviteCode(pCode) {
  const norm = normalizePendingInviteCode(pCode);
  if (!norm) {
    return { ok: false, errorReason: 'invalid_code', transportError: null };
  }
  const { data, error } = await supabase.rpc('redeem_invite_code', { p_code: norm });
  if (error) {
    return { ok: false, errorReason: null, transportError: error };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.success !== 'boolean') {
    return { ok: false, errorReason: 'redeem_failed', transportError: null };
  }
  return {
    ok: row.success === true,
    errorReason: row.error_reason || null,
    transportError: null,
  };
}

export function inviteRedeemErrorTitle() {
  return 'Приглашение';
}

export function inviteRedeemErrorMessage(reason) {
  const r = String(reason || '');
  const map = {
    not_authenticated: 'Нет активной сессии. Войдите снова.',
    invalid_code: 'Некорректный код приглашения.',
    not_found: 'Код не найден. Проверьте ввод.',
    expired: 'Срок действия кода истёк.',
    exhausted: 'Код уже использован.',
    already_redeemed: 'Ты уже использовал приглашение',
    redeem_failed: 'Не удалось применить код. Попробуйте позже.',
  };
  return map[r] || 'Не удалось применить приглашение.';
}
