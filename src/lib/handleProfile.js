import { supabase } from './supabase';

export const HANDLE_MAX = 32;
export const HANDLE_RE = /^[a-z0-9_]+$/;

/** @param {string} raw */
export function sanitizeHandleSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, HANDLE_MAX);
}

/**
 * @param {string} slug
 * @returns {{ ok: true } | { ok: false, title: string, message: string }}
 */
export function validateHandleFormat(slug) {
  if (slug.length < 1) {
    return { ok: false, title: 'Внимание', message: 'Введите handle (латиница, цифры, _).' };
  }
  if (!HANDLE_RE.test(slug)) {
    return { ok: false, title: 'Внимание', message: 'Только a–z, 0–9 и подчёркивание.' };
  }
  return { ok: true };
}

/** @returns {Promise<{ id: string } | null>} */
export async function findProfileByHandle(slug) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** @returns {Promise<import('@supabase/supabase-js').PostgrestError | null>} */
export async function insertProfileHandle(userId, handle) {
  const { error } = await supabase.from('profiles').insert({ id: userId, handle });
  return error;
}

/** @returns {Promise<import('@supabase/supabase-js').PostgrestError | null>} */
export async function updateProfileHandle(userId, handle) {
  const { error } = await supabase.from('profiles').update({ handle }).eq('id', userId);
  return error;
}

/**
 * Первичная установка handle после регистрации.
 * @returns {Promise<'ok' | 'taken' | 'already_has_profile'>}
 */
export async function saveNewProfileHandle(userId, handle) {
  const taken = await findProfileByHandle(handle);
  if (taken) return 'taken';

  const insErr = await insertProfileHandle(userId, handle);
  if (!insErr) return 'ok';

  if (insErr.code === '23505') {
    if (String(insErr.details || '').includes('(id)')) {
      return 'already_has_profile';
    }
    return 'taken';
  }

  throw insErr;
}

/**
 * Смена handle в профиле.
 * @returns {Promise<'ok' | 'unchanged' | 'taken'>}
 */
export async function saveUpdatedProfileHandle(userId, handle, previousHandle) {
  if (handle === previousHandle) return 'unchanged';

  const taken = await findProfileByHandle(handle);
  if (taken && taken.id !== userId) return 'taken';

  const updErr = await updateProfileHandle(userId, handle);
  if (!updErr) return 'ok';

  if (updErr.code === '23505') return 'taken';

  throw updErr;
}
