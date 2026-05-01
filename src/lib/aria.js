/** Виртуальная комната ассистента (не строка в `profiles`). */
export const ARIA_ROOM_ID = 'aria-direct';

/** POST `${ARIA_API_URL}/message` — замени на LAN-IP хоста с API (Expo с телефона не видит localhost ПК). */
export const ARIA_API_URL = 'http://192.168.1.101:8000';

/**
 * POST `${ARIA_API_URL}/transcribe` — голос → текст для чата с Aria.
 * @param {string} audioBase64 — сырые байты аудио в base64
 * @param {string} userId — Supabase auth user id
 * @returns {Promise<string>}
 */
export async function transcribeAriaVoice(audioBase64, userId) {
  const res = await fetch(`${ARIA_API_URL}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_base64: audioBase64,
      user_id: userId,
    }),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) throw new Error(`http_${res.status}`);
  const text = typeof json?.text === 'string' ? json.text : '';
  return text;
}

/** Строка ленты «Aria печатает…» (локально). */
export const ARIA_MESSAGE_TYPING = 'aria_typing';

export const ARIA_TYPING_ROW_ID = 'aria-typing-local';

/** Сообщение для истории API и сохранения (не строка typing). */
export function isAriaPersistableMessage(m) {
  return m.message_type !== ARIA_MESSAGE_TYPING && !m.isTyping;
}

/** Общие поля строки сообщения в локальном чате Aria. */
export function createAriaMessageBaseRow() {
  return {
    room_id: ARIA_ROOM_ID,
    reply_to: null,
    reactions: null,
    hidden_for: [],
    media_url: null,
    latitude: null,
    longitude: null,
    expires_at: null,
    waveform: null,
  };
}

export const ARIA_CONTACT = {
  id: 'aria-system',
  handle: 'aria',
  display_name: 'Aria',
  avatar: null,
  isSystem: true,
};

/** Одно приветственное сообщение для ленты `Chat` (локально, без БД). */
export function getAriaSeedMessages() {
  const now = new Date().toISOString();
  return [
    {
      id: 'aria-local-welcome',
      room_id: ARIA_ROOM_ID,
      player_name: ARIA_CONTACT.display_name,
      text: 'Привет. Я здесь.',
      created_at: now,
      read_at: now,
      reply_to: null,
      reactions: null,
      hidden_for: [],
      message_type: 'text',
      media_url: null,
      latitude: null,
      longitude: null,
      expires_at: null,
      waveform: null,
    },
  ];
}
