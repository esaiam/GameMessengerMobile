import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const RETRY_COOLDOWN_MS = 10 * 60 * 1000;
let lastAttemptAt = 0;
let lastSavedToken = null;
/** Firebase misconfig (FIS_AUTH_ERROR) — не спамим повторами до перезапуска. */
let firebaseAuthBlocked = false;

function isFirebaseAuthError(err) {
  const msg = String(err?.message ?? err ?? '');
  return msg.includes('FIS_AUTH_ERROR');
}

/**
 * Запрашивает разрешение на push, получает Expo push token и пишет его в profiles.push_token.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function registerPushToken(userId) {
  if (!userId) return null;
  if (Platform.OS === 'web') return null;
  if (firebaseAuthBlocked) return null;

  const now = Date.now();
  if (now - lastAttemptAt < RETRY_COOLDOWN_MS) {
    return lastSavedToken;
  }
  lastAttemptAt = now;

  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult?.data?.trim();
    if (!token) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId)
      .select('push_token')
      .single();

    if (error || data?.push_token !== token) {
      if (__DEV__) {
        console.warn('[notifications] push_token save failed', error?.message);
      }
      return null;
    }

    if (__DEV__) {
      console.log('[notifications] push_token saved', token.slice(0, 24));
    }
    lastSavedToken = token;
    return token;
  } catch (e) {
    if (isFirebaseAuthError(e)) {
      firebaseAuthBlocked = true;
      if (__DEV__) {
        console.warn(
          '[notifications] Firebase отклонил приложение (FIS_AUTH_ERROR). '
            + 'Проверь API key в Google Cloud (project vault-54acb). Повторы отключены до перезапуска.',
        );
      }
      return null;
    }
    if (__DEV__) console.warn('[notifications]', e?.message ?? e);
    return null;
  }
}

/** Clear token on logout so stale devices do not receive push. */
export async function clearPushToken(userId) {
  if (!userId) return;
  try {
    await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
  } catch (e) {
    if (__DEV__) console.warn('[notifications] clear failed', e?.message ?? e);
  }
}

/**
 * Foreground alert + route Aria push taps to chat.
 * @param {{ onAriaNotificationTap?: (data: object) => void }} [opts]
 */
export function setupPushNotificationHandlers(opts = {}) {
  const { onAriaNotificationTap } = opts;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const handleResponse = (response) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.isAria && typeof onAriaNotificationTap === 'function') {
      onAriaNotificationTap(data);
    }
  };

  const responseSub =
    Notifications.addNotificationResponseReceivedListener(handleResponse);

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleResponse(response);
  });

  return () => {
    responseSub.remove();
  };
}
