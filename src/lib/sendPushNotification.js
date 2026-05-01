const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * @param {{ to: string; title: string; body: string; data?: Record<string, unknown> }} params
 */
export async function sendPushNotification({ to, title, body, data }) {
  if (!to) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        title,
        body,
        data: data ?? {},
        sound: 'default',
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[sendPushNotification]', res.status, text);
    }
  } catch (e) {
    console.warn('[sendPushNotification]', e?.message ?? e);
  }
}
