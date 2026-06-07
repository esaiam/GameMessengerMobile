import { supabase } from './supabase';
import { readUriAsArrayBuffer } from '../components/chat/chatMediaIo';

export const PROFILE_AVATAR_BUCKET = 'avatars';
export const PROFILE_AVATAR_OBJECT_NAME = 'avatar.jpg';

/** Storage object path: `{user_id}/avatar.jpg` */
export function profileAvatarStoragePath(userId) {
  if (!userId) return null;
  return `${userId}/${PROFILE_AVATAR_OBJECT_NAME}`;
}

/**
 * Upload local JPEG to `avatars` and persist path on `profiles`.
 * @param {string} localUri file:// or content:// URI of saved avatar
 * @returns {Promise<{ path: string, updatedAt: string }>}
 */
export async function uploadProfileAvatarFromLocalUri(localUri) {
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;

  const userId = auth?.user?.id;
  if (!userId) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const path = profileAvatarStoragePath(userId);
  const arrayBuffer = await readUriAsArrayBuffer(localUri);

  const { error: uploadErr } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadErr) {
    if (__DEV__) console.warn('[profileAvatar] storage upload:', uploadErr.message);
    throw new Error('UPLOAD_FAILED');
  }

  const updatedAt = new Date().toISOString();
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      avatar_path: path,
      avatar_updated_at: updatedAt,
    })
    .eq('id', userId);

  if (profileErr) {
    if (__DEV__) console.warn('[profileAvatar] profiles update:', profileErr.message);
    throw new Error('UPLOAD_FAILED');
  }

  return { path, updatedAt };
}

/** @param {string | undefined} code */
export function profileAvatarSaveErrorMessage(code) {
  switch (code) {
    case 'UPLOAD_FAILED':
      return 'Фото сохранено на устройстве, но не загрузилось на сервер. Проверьте сеть.';
    case 'NOT_AUTHENTICATED':
      return 'Сессия недоступна. Войдите снова.';
    default:
      return 'Не удалось сохранить фото.';
  }
}
