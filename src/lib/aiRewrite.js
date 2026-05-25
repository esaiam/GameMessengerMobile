import { supabase } from './supabase';
import { invokeVaultEdgeFunction } from './edgeFunctions';

/**
 * @param {Response} res
 */
async function parseRewriteResponse(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const msg =
      typeof body?.error === 'string'
        ? body.error
        : res.status === 404
          ? 'Функция ai-rewrite не развёрнута'
          : `Ошибка ИИ-редактора (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (body?.error) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Ошибка запроса');
  }
  const text = body?.text;
  return typeof text === 'string' ? text.trim() : '';
}

/**
 * @returns {Promise<import('@supabase/supabase-js').Session>}
 */
async function requireFreshSession() {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Войдите в аккаунт');
  }

  const expiresAt = session.expires_at;
  if (expiresAt && expiresAt * 1000 < Date.now() + 60_000) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error) {
      throw new Error('Сессия истекла — выйдите и войдите снова');
    }
    if (refreshed?.session?.access_token) {
      session = refreshed.session;
    }
  }

  return session;
}

/**
 * Переписывание текста через edge function ai-rewrite (Groq на сервере).
 * @param {{ style: string; sourceText: string }} params
 * @returns {Promise<string>}
 */
export async function requestAiRewrite({ style, sourceText }) {
  const session = await requireFreshSession();
  const res = await invokeVaultEdgeFunction('ai-rewrite', session.access_token, {
    style,
    sourceText,
  });
  return parseRewriteResponse(res);
}
