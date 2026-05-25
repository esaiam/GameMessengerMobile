import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { parseAriaMessageAttachment } from './ariaAttachment';

/** Виртуальная комната ассистента (не строка в `profiles`). */
export const ARIA_ROOM_ID = 'aria-direct';

/** Aria-lite на LAN (IP ПК в Wi‑Fi; тот же, что у Metro QR — `ipconfig`, сейчас .101). */
export const ARIA_LITE_LAN_URL = 'http://192.168.1.101:8001';

/** Тот же ПК, что и сервер (Expo web / клиент на localhost). */
export const ARIA_LITE_LOCAL_URL = 'http://127.0.0.1:8001';

function stripTrailingSlashes(url) {
  return typeof url === 'string' ? url.replace(/\/+$/, '') : '';
}

/** IPv4 хоста Metro (тот же, что в QR `exp://…:8081`). */
function hostFromExpoDevServer() {
  const raw =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    Constants.manifest?.debuggerHost;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const host = raw.replace(/^[a-z]+:\/\//, '').split('/')[0].split(':')[0]?.trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : '';
}

function ariaUrlFromDevMetro() {
  const host = hostFromExpoDevServer();
  return host ? `http://${host}:8001` : '';
}

/**
 * Dev native: IP из Metro (не зашитый в EAS dev APK eas.json).
 * Web dev: 127.0.0.1. Prod: EXPO_PUBLIC_ARIA_API_URL.
 */
export function resolveAriaApiBaseUrl() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (Platform.OS === 'web') return ARIA_LITE_LOCAL_URL;
    const fromMetro = ariaUrlFromDevMetro();
    if (fromMetro) return fromMetro;
  }
  const fromEnv = stripTrailingSlashes(process.env.EXPO_PUBLIC_ARIA_API_URL);
  if (fromEnv) return fromEnv;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return ARIA_LITE_LAN_URL;
  }
  return '';
}

/** База Aria-lite / полной Aria (не хардкодить :8000). */
export function getAriaApiBaseUrl() {
  return resolveAriaApiBaseUrl();
}

export const DEFAULT_ARIA_STATE = {
  mood: 0,
  hurt: 0,
  energy: 0.5,
  trust: 0,
  boredom: 0,
  relationship_level: 0,
  is_sick: false };

export function to01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const x = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, x));
}

export function clampBipolar(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const x = n > 1 || n < -1 ? n / 100 : n;
  return Math.max(-1, Math.min(1, x));
}

/** hurt >= 0.7 ИЛИ (boredom >= 0.9 и energy < 0.25) */
export function computeIsSick({ hurt, boredom, energy, is_sick }) {
  if (is_sick === true) return true;
  const h = to01(hurt);
  const b = to01(boredom);
  const e = to01(energy);
  return h >= 0.7 || (b >= 0.9 && e < 0.25);
}

export function normalizeAriaState(json) {
  if (!json || typeof json !== 'object') {
    return { ...DEFAULT_ARIA_STATE };
  }
  const state = {
    mood: clampBipolar(json.mood),
    hurt: to01(json.hurt),
    energy: to01(json.energy),
    trust: clampBipolar(json.trust),
    boredom: to01(json.boredom),
    relationship_level: to01(json.relationship_level),
    is_sick: json.is_sick === true };
  state.is_sick = computeIsSick(state);
  return state;
}

/** GET /health — для индикатора «онлайн» в шапке чата. */
export async function checkAriaHealth(signal) {
  const base = getAriaApiBaseUrl();
  if (!base) return false;
  const url = `${base}/health`;
  try {
    const res = await fetch(url, { signal });
    let json = {};
    try {
      json = await res.json();
    } catch {
      json = {};
    }
    const ok = res.ok && (json?.status === 'ok' || json?.status === 'OK' || json?.ok === true);
    if (__DEV__ && !ok) {
      console.warn('[Vault][dev] Aria health', url, '->', res.status, json);
    }
    return ok;
  } catch (err) {
    if (__DEV__) {
      console.warn('[Vault][dev] Aria health FAILED:', url, err?.message || String(err));
    }
    return false;
  }
}

if (__DEV__) {
  const devBase = getAriaApiBaseUrl();
  if (devBase) {
    console.log('[Vault][dev] ARIA_API_URL =', devBase);
    checkAriaHealth().then((ok) => {
      console.log('[Vault][dev] Aria health probe ->', ok ? 'ok' : 'FAIL');
    });
  }
}

/** GET /state?user_id= — mood, hurt, energy, trust, boredom для UI. */
export async function fetchAriaState(userId) {
  const base = getAriaApiBaseUrl();
  if (!base || !userId) return null;
  try {
    const res = await fetch(`${base}/state?user_id=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    let json = {};
    try {
      json = await res.json();
    } catch {
      return null;
    }
    return normalizeAriaState(json);
  } catch {
    return null;
  }
}

function extractPendingTexts(json) {
  if (!json || typeof json !== 'object') return [];
  const raw = json.messages ?? json.pending_messages ?? json.pending ?? json;
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const t = item.text ?? item.message ?? item.content;
        return typeof t === 'string' ? t.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

/** GET /pending_messages?user_id= — проактивные реплики Aria. */
export async function fetchAriaPendingMessages(userId) {
  const base = getAriaApiBaseUrl();
  if (!base || !userId) return [];
  try {
    const res = await fetch(
      `${base}/pending_messages?user_id=${encodeURIComponent(userId)}`
    );
    if (!res.ok) return [];
    let json = {};
    try {
      json = await res.json();
    } catch {
      return [];
    }
    return extractPendingTexts(json);
  } catch {
    return [];
  }
}

/**
 * POST /message — ответ: { reply, mood, trust, state, attachment? }.
 * attachment — при генерации файла: file_base64, filename, mime_type, size_bytes.
 * @param {{ userId: string, text: string, history: Array<{ role: string, text: string }> }} p
 */
export async function postAriaMessage({ userId, text, history }) {
  const base = getAriaApiBaseUrl();
  if (!base || !userId) throw new Error('no_api');
  const res = await fetch(`${base}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      text,
      platform: 'vault',
      history: Array.isArray(history) ? history : [] }) });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) throw new Error(`http_${res.status}`);

  const replyRaw = json?.reply;
  const reply =
    typeof replyRaw === 'string' && replyRaw.length > 0
      ? replyRaw
      : typeof json?.message === 'string' && json.message.length > 0
        ? json.message
        : '';

  const attachment = parseAriaMessageAttachment(json);

  return {
    reply,
    mood: json?.mood,
    trust: json?.trust,
    state: normalizeAriaState(json),
    attachment };
}

/**
 * POST /transcribe — голос → текст для чата с Aria.
 * @param {string} audioBase64
 * @param {string} userId — Supabase auth user id
 */
export async function transcribeAriaVoice(audioBase64, userId) {
  const base = getAriaApiBaseUrl();
  if (!base) throw new Error('no_api');
  const res = await fetch(`${base}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_base64: audioBase64,
      user_id: userId }) });
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

function historyRoleFromMessage(m) {
  if (m.aria_api_role === 'assistant' || m.aria_api_role === 'aria') return m.aria_api_role;
  if (m.player_name === ARIA_CONTACT.display_name) return 'aria';
  return 'user';
}

/**
 * Последние до 20 сообщений для POST /message.
 * role: user | aria | assistant
 */
export function buildAriaRequestHistory(messages, opts = {}) {
  const filtered = messages.filter(isAriaPersistableMessage);
  const mapped = filtered.slice(-20).map((m) => ({
    role: historyRoleFromMessage(m),
    text: typeof m.text === 'string' ? m.text : '' }));
  if (opts.lastUserTextOverride) {
    for (let i = mapped.length - 1; i >= 0; i -= 1) {
      if (mapped[i].role === 'user') {
        mapped[i] = { ...mapped[i], text: opts.lastUserTextOverride };
        break;
      }
    }
  }
  return mapped;
}

/** role из `aria_messages` → API history role. */
export function ariaDbRoleToApiRole(dbRole) {
  if (dbRole === 'user') return 'user';
  if (dbRole === 'assistant') return 'assistant';
  return 'aria';
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
    waveform: null };
}

export const ARIA_CONTACT = {
  id: 'aria-system',
  handle: 'aria',
  display_name: 'Ария',
  avatar: null,
  isSystem: true };

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
      aria_api_role: 'aria' }];
}
