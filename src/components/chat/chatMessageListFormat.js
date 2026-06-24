/**
 * Pure helpers for inverted chat message list: row cache keys, timestamps, voice caption duration.
 */

export function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - msgDay) / 86400000;
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatDateKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function stableReactionsSig(reactions) {
  if (reactions == null) return '';
  if (typeof reactions !== 'object') return String(reactions);
  const keys = Object.keys(reactions).sort();
  let s = '';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = reactions[k];
    s += k;
    s += ':';
    s += Array.isArray(v) ? v.join(',') : String(v);
    s += ';';
  }
  return s;
}

function stableWaveformSig(waveform) {
  if (waveform == null) return '';
  if (!Array.isArray(waveform)) return String(waveform);
  return waveform.join(',');
}

function stableAriaAttachmentSig(attachment) {
  if (attachment == null) return '';
  if (typeof attachment !== 'object') return String(attachment);
  return [attachment.mime_type ?? '', attachment.url ?? '', attachment.data ?? ''].join('|');
}

/** Сигнал для инвалидации кэша строки: все поля, от которых зависит пузырь и разделители дат. */
/** @param {import('./chatMessageTypes').ChatMessageRow} m */
export function messageRowContentSig(m) {
  if (!m) return '';
  return [
    m.id,
    m.created_at ?? '',
    m.player_name ?? '',
    m.text ?? '',
    m.message_type ?? '',
    m.media_url ?? '',
    m.read_at ?? '',
    m.edited_at ?? '',
    m.expires_at ?? '',
    m.reply_to ?? '',
    m.latitude ?? '',
    m.longitude ?? '',
    m._isOptimistic ? '1' : '0',
    stableWaveformSig(m.waveform),
    m.transcription ?? '',
    m.aria_voice_message ? '1' : '0',
    m.audio_uri ?? '',
    stableAriaAttachmentSig(m.aria_attachment),
    m.isTyping ? '1' : '0',
    m.aria_stream_phase ?? '',
    m.aria_stream_preview ?? '',
    m.aria_reveal_done === false ? '0' : '1',
    m.aria_feedback_rating ?? '',
    m.aria_feedback_pending ? '1' : '0',
    stableReactionsSig(m.reactions)].join('\x1e');
}

/**
 * `next` — это `prev` с одним новым сообщением в конце (хронология: старые → новые).
 * @param {import('./chatMessageTypes').ChatMessageRow[]|null|undefined} prev
 * @param {import('./chatMessageTypes').ChatMessageRow[]} next
 */
export function isMessagesStrictAppend(prev, next) {
  if (!prev || !next) return false;
  if (next.length !== prev.length + 1) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id) return false;
  }
  return true;
}

/**
 * Одна строка inverted-ленты для пары (сообщение, сосед ниже по списку / старее по времени).
 * @param {import('./chatMessageTypes').ChatMessageRow} msg
 * @param {import('./chatMessageTypes').ChatMessageRow|null} above
 * @param {Map<string, { row: import('./chatMessageTypes').ChatFormattedMessageRow, msgSig: string, aboveSig: string }>} cache
 * @param {Set<string>} [seenOpt] — если передан, ключ добавляется для последующей очистки кэша.
 */
export function buildFormattedRowCached(msg, above, cache, seenOpt) {
  const key = `${msg.id}\t${above ? above.id : ''}`;
  const msgSig = messageRowContentSig(msg);
  const aboveSig = above ? messageRowContentSig(above) : '';

  const prev = cache.get(key);
  if (prev && prev.msgSig === msgSig && prev.aboveSig === aboveSig) {
    if (seenOpt) seenOpt.add(key);
    return prev.row;
  }

  const dateLabel = formatDateLabel(msg.created_at);
  const aboveDateLabel = above ? formatDateLabel(above.created_at) : null;
  const dateKey = formatDateKey(msg.created_at);
  const row = {
    ...msg,
    _formattedTime: formatTime(msg.created_at),
    _dateLabel: dateLabel,
    _dateKey: dateKey,
    _showDate: !above || dateLabel !== aboveDateLabel,
    _sameDay: above ? dateLabel === aboveDateLabel : false,
    _abovePlayerName: above ? above.player_name : null };
  cache.set(key, { row, msgSig, aboveSig });
  if (seenOpt) seenOpt.add(key);
  return row;
}

/**
 * Быстрый путь: новое сообщение только в хвосте `messages` — один новый formatted-row сверху,
 * остальная лента без полного пересчёта.
 * @returns {import('./chatMessageTypes').ChatFormattedMessageRow[]|null}
 */
export function prependFormattedWhenTailAppended(prevMessages, nextMessages, prevFormatted, cache) {
  if (!isMessagesStrictAppend(prevMessages, nextMessages)) return null;
  const n = nextMessages.length;
  const newMsg = nextMessages[n - 1];
  const above = n >= 2 ? nextMessages[n - 2] : null;
  const row = buildFormattedRowCached(newMsg, above, cache);
  return [row, ...prevFormatted];
}

/**
 * Лента для inverted FlatList: новые сообщения — меньший индекс.
 * Кэш по ключу `msg.id` + `above.id` и сигнатурам контента — сохраняем ссылки на объекты `item`,
 * чтобы MessageRow (React.memo) не перерисовывался при неизменных данных.
 * @param {import('./chatMessageTypes').ChatMessageRow[]} messages
 * @param {Map<string, { row: import('./chatMessageTypes').ChatFormattedMessageRow, msgSig: string, aboveSig: string }>} cache
 * @returns {import('./chatMessageTypes').ChatFormattedMessageRow[]}
 */
export function buildFormattedMessagesCached(messages, cache) {
  if (!messages.length) {
    cache.clear();
    return [];
  }
  const n = messages.length;
  const out = new Array(n);
  const seen = new Set();

  for (let index = 0; index < n; index++) {
    const msg = messages[n - 1 - index];
    const above = index + 1 < n ? messages[n - 1 - (index + 1)] : null;
    out[index] = buildFormattedRowCached(msg, above, cache, seen);
  }

  for (const k of cache.keys()) {
    if (!seen.has(k)) cache.delete(k);
  }
  return out;
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Длительность из подписи `🎤 m:ss` для таймера без активного нативного статуса. */
export function parseVoiceCaptionDurationSec(text) {
  if (!text || typeof text !== 'string') return 0;
  const m = text.match(/🎤\s*(\d+):(\d{2})/);
  if (!m) return 0;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  if (!Number.isFinite(min) || !Number.isFinite(sec)) return 0;
  return min * 60 + sec;
}
