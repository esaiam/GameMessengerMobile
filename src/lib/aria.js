import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { parseAriaMessageAttachment } from './ariaAttachment';
import { supabase } from './supabase';

/** Виртуальная комната ассистента (не строка в `profiles`). */
export const ARIA_ROOM_ID = 'aria-direct';

/** Fallback Aria-lite в LAN (Expo web / dev без EXPO_PUBLIC_ARIA_API_URL). */
export const ARIA_LITE_LOCAL_URL = 'http://192.168.1.100:8001';

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
 * EXPO_PUBLIC_ARIA_API_URL — приоритет ( .env / eas.json ).
 * Dev native без env: IP из Metro QR (hostUri → :8001), затем ARIA_LITE_LOCAL_URL.
 * Web dev без env: ARIA_LITE_LOCAL_URL.
 */
export function resolveAriaApiBaseUrl() {
  const fromEnv = stripTrailingSlashes(process.env.EXPO_PUBLIC_ARIA_API_URL);
  if (fromEnv) return fromEnv;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (Platform.OS === 'web') return ARIA_LITE_LOCAL_URL;
    const fromMetro = ariaUrlFromDevMetro();
    if (fromMetro) return fromMetro;
    return ARIA_LITE_LOCAL_URL;
  }
  return '';
}

/** База Aria-lite / полной Aria (не хардкодить :8000). */
export function getAriaApiBaseUrl() {
  return resolveAriaApiBaseUrl();
}

/**
 * Заголовки для Aria API: Vault Supabase JWT (фаза A3).
 * Без сессии — только extra; бэкенд вернёт 401 при ARIA_REQUIRE_AUTH=true.
 */
export async function getAriaAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const { data, error } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!error && typeof token === 'string' && token.length > 0) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // нет сессии — вызывающий код получит 401 от Aria
  }
  return headers;
}

/** fetch к Aria с JWT (кроме публичного /health). */
async function ariaFetch(url, options = {}) {
  const headers = await getAriaAuthHeaders(options.headers || {});
  return fetch(url, { ...options, headers });
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
    const ok =
      res.ok &&
      (json?.status === 'ok' ||
        json?.status === 'OK' ||
        json?.status === 'degraded' ||
        json?.ok === true);
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
    const res = await ariaFetch(`${base}/state?user_id=${encodeURIComponent(userId)}`);
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
    const res = await ariaFetch(
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
function extractBehaviorPolicyIds(metadata) {
  if (!metadata || typeof metadata !== 'object') return [];
  const ids = metadata.behavior_policy_ids;
  if (!Array.isArray(ids)) return [];
  return ids.map((x) => String(x).trim()).filter(Boolean);
}

function normalizeAriaMessageResponse(json) {
  const replyRaw = json?.reply;
  const reply =
    typeof replyRaw === 'string' && replyRaw.length > 0
      ? replyRaw
      : typeof json?.message === 'string' && json.message.length > 0
        ? json.message
        : '';
  const attachment = parseAriaMessageAttachment(json);
  const metadata =
    json?.metadata && typeof json.metadata === 'object' ? json.metadata : null;
  const behavior_policy_ids = extractBehaviorPolicyIds(metadata);
  return {
    reply,
    mood: json?.mood,
    trust: json?.trust,
    state: normalizeAriaState(json),
    attachment,
    metadata,
    behavior_policy_ids,
  };
}

/**
 * POST /messages/feedback — explicit 👍/👎 on an Aria reply (learning spine phase 4).
 */
export async function postAriaMessageFeedback({
  userId,
  rating,
  behaviorPolicyIds = [],
  messagePreview = '',
}) {
  const base = getAriaApiBaseUrl();
  if (!base || !userId) throw new Error('no_api');
  const res = await ariaFetch(`${base}/messages/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      rating,
      behavior_policy_ids: behaviorPolicyIds,
      message_preview: messagePreview,
    }),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) {
    const detail =
      typeof json?.detail === 'string'
        ? json.detail
        : `feedback_http_${res.status}`;
    throw new Error(detail);
  }
  return json;
}

export async function postAriaMessage({ userId, text, history }) {
  const base = getAriaApiBaseUrl();
  if (!base || !userId) throw new Error('no_api');
  const res = await ariaFetch(`${base}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      text,
      platform: 'vault',
      history: Array.isArray(history) ? history : [],
      skip_push: true,
    }),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) throw new Error(`http_${res.status}`);
  return normalizeAriaMessageResponse(json);
}

function parseSseBlocks(buffer) {
  const events = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  for (const block of parts) {
    if (!block.trim()) continue;
    let event = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^\s/, ''));
    }
    const raw = dataLines.join('\n');
    let data = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      /* plain text frame */
    }
    events.push({ event, data });
  }
  return { events, remainder };
}

/**
 * POST /message/stream — SSE: status → delta* → (replace?) → done.
 */
export async function postAriaMessageStream({
  userId,
  text,
  history,
  onStatus,
  onDelta,
  onReplace,
  signal,
}) {
  const base = getAriaApiBaseUrl();
  if (!base || !userId) throw new Error('no_api');
  const res = await ariaFetch(`${base}/message/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      user_id: userId,
      text,
      platform: 'vault',
      history: Array.isArray(history) ? history : [],
      skip_push: true,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  if (!res.body || typeof res.body.getReader !== 'function') {
    throw new Error('no_stream_body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamedText = '';
  let finalPayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseBlocks(buffer);
    buffer = remainder;
    for (const frame of events) {
      const { event, data } = frame;
      if (event === 'status' && data && typeof data === 'object' && data.phase) {
        onStatus?.(data.phase);
      } else if (event === 'delta' && data && typeof data === 'object' && typeof data.text === 'string') {
        streamedText += data.text;
        onDelta?.(data.text, streamedText);
      } else if (event === 'replace' && data && typeof data === 'object' && typeof data.text === 'string') {
        streamedText = data.text;
        onReplace?.(data.text);
        onDelta?.('', streamedText);
      } else if (event === 'done' && data && typeof data === 'object') {
        finalPayload = data;
      } else if (event === 'error') {
        const detail =
          data && typeof data === 'object' && data.detail != null
            ? String(data.detail)
            : 'stream_error';
        throw new Error(detail);
      }
    }
  }

  if (!finalPayload) {
    if (streamedText.trim()) {
      return normalizeAriaMessageResponse({ reply: streamedText });
    }
    throw new Error('stream_incomplete');
  }
  const normalized = normalizeAriaMessageResponse(finalPayload);
  if (!normalized.reply && streamedText) {
    normalized.reply = streamedText;
  }
  return normalized;
}

/**
 * POST /transcribe — голос → текст для чата с Aria.
 * @param {string} audioBase64
 * @param {string} userId — Supabase auth user id
 */
export async function transcribeAriaVoice(audioBase64, userId) {
  const base = getAriaApiBaseUrl();
  if (!base) throw new Error('no_api');
  const res = await ariaFetch(`${base}/transcribe`, {
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

/** SSE /message/stream phases → подпись под сферой (сфера = процесс мышления, не «печатает»). */
export function formatAriaStreamPhase(phase) {
  switch (phase) {
    case 'memory':
      return 'вспоминаю…';
    case 'thinking':
    case 'generating':
    case 'ready':
    default:
      return 'думаю…';
  }
}

/** Макс. сообщений в ленте и в `aria_messages` (без typing). */
export const ARIA_CHAT_MAX_STORED_MESSAGES = 20;

/** Сколько последних реплик слать в POST /message (UI хранит до 20). */
export const ARIA_HISTORY_LIMIT_FULL = 20;
export const ARIA_HISTORY_LIMIT_NORMAL = 12;
export const ARIA_HISTORY_LIMIT_CASUAL = 8;
export const ARIA_HISTORY_LIMIT_MIN = 6;

const _MEMORY_RECALL_FRAGMENTS = [
  'помнишь',
  'запомнила',
  'запомнил',
  'мы говорили',
  'кто я',
  'кто ты',
  'кто меня',
  'кто тебя',
  'разрабатыва',
  'мой разработчик',
  'тебя разрабатывает',
  'ты помнишь',
];

const _DETAILED_REQUEST_MARKERS = [
  'расскажи подробно',
  'расскажи про',
  'расскажи о ',
  'расскажи об ',
  'расскажи мне',
  'объясни',
  'что такое',
  'кто такой',
  'как работает',
  'опиши',
  'перечисли',
  'какие бывают',
  'история возникновения',
  'история создания',
  'основная информация',
  'основную информацию',
  'основные факты',
  'основное о',
  'что знаешь о',
  'что ты знаешь о',
];

const _NEWS_QUERY_MARKERS = [
  'новост',
  'что происходит',
  'что случилось',
  'что в мире',
  'что нового',
  'актуальн',
  'на сегодня',
  'на данный момент',
  'текущий момент',
  'сводка',
  'что важного',
  'важные события',
  'мировые события',
  'что там в',
];

const _FOLLOW_UP_MARKERS = [
  'продолж',
  'дальше',
  'насчёт',
  'насчет',
  'уточни',
  'а про ',
  'а о ',
  'а об ',
  'вернёмся',
  'вернемся',
  'как мы ',
  'то что ',
];

function _normText(text) {
  return typeof text === 'string' ? text.trim() : '';
}

/** Запрос «помнишь / кто я» — нужна длинная история. */
export function isAriaMemoryRecallQuery(text) {
  const low = _normText(text).toLowerCase();
  if (!low) return false;
  return _MEMORY_RECALL_FRAGMENTS.some((frag) => low.includes(frag));
}

/** Информационный запрос — нужен полный контекст. */
export function isAriaDetailedRequest(text) {
  const low = _normText(text).toLowerCase();
  if (!low) return false;
  return _DETAILED_REQUEST_MARKERS.some((m) => low.includes(m));
}

/** Новости / сводка — полный контекст. */
export function isAriaNewsQuery(text) {
  const low = _normText(text).toLowerCase();
  if (!low) return false;
  return _NEWS_QUERY_MARKERS.some((m) => low.includes(m));
}

/** Короткий ping без «?» («ок», «привет») — зеркало Aria is_low_semantic_load_message. */
export function isAriaLowSemanticLoadMessage(text) {
  const stripped = _normText(text);
  if (!stripped) return true;
  if (isAriaMemoryRecallQuery(stripped)) return false;
  if (stripped.includes('?')) return false;
  return stripped.length <= 40;
}

function _looksLikeFollowUp(text) {
  const low = _normText(text).toLowerCase();
  if (!low) return false;
  return _FOLLOW_UP_MARKERS.some((m) => low.includes(m));
}

/**
 * Сколько последних сообщений отправить в Aria для текущей реплики.
 * casual 6–8 / normal 12 / full 20.
 */
export function resolveAriaHistoryLimit(currentText) {
  const t = _normText(currentText);
  if (!t) return ARIA_HISTORY_LIMIT_CASUAL;

  if (isAriaMemoryRecallQuery(t) || isAriaDetailedRequest(t) || isAriaNewsQuery(t)) {
    return ARIA_HISTORY_LIMIT_FULL;
  }
  if (t.length > 120) return ARIA_HISTORY_LIMIT_FULL;
  if (_looksLikeFollowUp(t)) return ARIA_HISTORY_LIMIT_NORMAL;

  if (isAriaLowSemanticLoadMessage(t)) {
    return t.length <= 15 ? ARIA_HISTORY_LIMIT_MIN : ARIA_HISTORY_LIMIT_CASUAL;
  }
  if (t.includes('?')) return ARIA_HISTORY_LIMIT_NORMAL;
  return ARIA_HISTORY_LIMIT_NORMAL;
}

/** Сообщение для истории API и сохранения (не строка typing). */
export function isAriaPersistableMessage(m) {
  return m.message_type !== ARIA_MESSAGE_TYPING && !m.isTyping;
}

/** Новый ответ Aria — показываем typewriter (явный false, не undefined). */
export function isAriaTypewriterPending(m) {
  return m != null && m.aria_reveal_done === false;
}

/** Оставляет последние N persistable; typing-строки не считаются и остаются в хвосте. */
export function trimAriaDisplayMessages(messages, maxCount = ARIA_CHAT_MAX_STORED_MESSAGES) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }
  const typingRows = messages.filter((m) => !isAriaPersistableMessage(m));
  const persistable = messages.filter(isAriaPersistableMessage);
  if (persistable.length <= maxCount) {
    return messages;
  }
  return [...persistable.slice(-maxCount), ...typingRows];
}

function historyRoleFromMessage(m) {
  if (m.aria_api_role === 'assistant' || m.aria_api_role === 'aria') return m.aria_api_role;
  if (m.player_name === ARIA_CONTACT.display_name) return 'aria';
  return 'user';
}

/**
 * Последние N сообщений для POST /message (N зависит от типа текущей реплики).
 * role: user | aria | assistant
 * @param {object} [opts]
 * @param {string} [opts.currentText] — текущее сообщение пользователя (для лимита)
 * @param {number} [opts.historyLimit] — явный лимит (иначе resolveAriaHistoryLimit)
 * @param {string} [opts.lastUserTextOverride] — подмена последней user-реплики
 */
export function buildAriaRequestHistory(messages, opts = {}) {
  const filtered = messages.filter(isAriaPersistableMessage);
  const currentText =
    typeof opts.currentText === 'string'
      ? opts.currentText
      : typeof opts.lastUserTextOverride === 'string'
        ? opts.lastUserTextOverride
        : '';
  const limit = Math.min(
    ARIA_CHAT_MAX_STORED_MESSAGES,
    Math.max(
      1,
      Number.isFinite(opts.historyLimit)
        ? opts.historyLimit
        : resolveAriaHistoryLimit(currentText),
    ),
  );
  const mapped = filtered.slice(-limit).map((m) => ({
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
  if (__DEV__ && currentText) {
    console.log(
      '[Vault][dev] Aria history:',
      mapped.length,
      'msgs (limit',
      limit,
      ') for',
      currentText.slice(0, 48),
    );
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
