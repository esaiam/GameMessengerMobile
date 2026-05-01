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
    m.expires_at ?? '',
    m.reply_to ?? '',
    m.latitude ?? '',
    m.longitude ?? '',
    stableReactionsSig(m.reactions),
  ].join('\x1e');
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
    const key = `${msg.id}\t${above ? above.id : ''}`;
    const msgSig = messageRowContentSig(msg);
    const aboveSig = above ? messageRowContentSig(above) : '';

    const prev = cache.get(key);
    if (prev && prev.msgSig === msgSig && prev.aboveSig === aboveSig) {
      out[index] = prev.row;
      seen.add(key);
      continue;
    }

    const dateLabel = formatDateLabel(msg.created_at);
    const aboveDateLabel = above ? formatDateLabel(above.created_at) : null;
    const row = {
      ...msg,
      _formattedTime: formatTime(msg.created_at),
      _dateLabel: dateLabel,
      _showDate: !above || dateLabel !== aboveDateLabel,
      _sameDay: above ? dateLabel === aboveDateLabel : false,
      _abovePlayerName: above ? above.player_name : null,
    };
    cache.set(key, { row, msgSig, aboveSig });
    out[index] = row;
    seen.add(key);
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
