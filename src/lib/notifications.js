import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Запрашивает разрешение на push, получает Expo push token и пишет его в profiles.push_token.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function registerPushToken(userId) {
  console.warn('PUSH USER ID:', userId);
  if (!userId) return null;

  try {
    const perm = await Notifications.requestPermissionsAsync();
    console.warn('PUSH PERMISSION:', perm.status);
    if (perm.status !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResult?.data;
    console.warn('PUSH TOKEN:', token);
    if (!token) {
      return null;
    }

    const { data, error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    console.warn('PUSH SUPABASE:', data, error);

    if (error) {
      console.warn('[notifications] profiles push_token update:', error.message);
      return null;
    }

    return token;
  } catch (e) {
    console.warn('[notifications]', e?.message ?? e);
    return null;
  }
}
