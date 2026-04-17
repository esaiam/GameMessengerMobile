import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  Modal,
  Pressable,
  Keyboard,
  Image,
  Linking,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import SafeBlurView from './SafeBlurView';
import tw from 'twrnc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { deriveKey, encrypt, decrypt, looksLikeEncryptedPayload } from '../utils/crypto';
import { getOrCreateKeyPair } from '../utils/VaultKeyStore';
import { publishMyPublicKey } from '../utils/VaultKeyServer';
import { encryptMessage, decryptMessage, isVaultEncrypted } from '../utils/VaultCrypto';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import VoiceRecorder from './chat/VoiceRecorder';
import ChatRoomHeader from './ChatRoomHeader';
import ChatBackgroundNoise from './ChatBackgroundNoise';
import VideoMessage from '../components/chat/VideoMessage';
import VoiceMessagePlayer from './chat/VoiceMessagePlayer';
import BubbleSkiaGradient from './chat/BubbleSkiaGradient';
import OutgoingBubble from './chat/OutgoingBubble';
import {
  Send,
  X,
  Paperclip,
  Smile,
  KeyboardIcon,
  Camera,
  ImageIcon,
  MapPin,
  Trash2,
  Check,
  CheckCheck,
  Flame,
  Timer,
} from '../icons/lucideIcons';
import Reanimated, {
  useSharedValue,
  useAnimatedScrollHandler,
  runOnJS,
} from 'react-native-reanimated';
import { V, TAB_BAR_LAYOUT, TAB_BAR_INNER_ROW_H } from '../theme';

/** Подсветка строки в режиме выбора (ширина контента ленты); нейтральный серый из токенов */
const MESSAGE_ROW_SELECTION_BG = V.border;
import { File as ExpoFile, Paths } from 'expo-file-system';
import CryptoJS from 'crypto-js';

const LongPressView = ({ onLongPress, delayLongPress, style, children }) => (
  <Pressable
    onLongPress={onLongPress}
    delayLongPress={delayLongPress}
    style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
  >
    {children}
  </Pressable>
);

const CHAT_BG_PATTERN = require('../../assets/chat-bg-gaming.jpg');

/** Пузыри: Design.mdc */
const BUBBLE_RADIUS = 18;
const BUBBLE_TAIL = 4;
const MSG_TEXT_SIZE = 15;
const MSG_LINE_HEIGHT = Math.round(MSG_TEXT_SIZE * 1.45);
const TS_TEXT_SIZE = 11;
/** Резерв ширины под время+галочки (только NBSP — без дублирования цифр времени в spacer). */
const META_RESERVE_NBSP_INCOMING = 12;
const META_RESERVE_NBSP_OUTGOING = 22;
const META_RESERVE_NBSP_EPHEMERAL_EXTRA = 10;

/** Расстояние до низа, меньше которого считаем пользователя «внизу» (как в Telegram). */
const CHAT_AT_BOTTOM_THRESHOLD_PX = 40;

const BUBBLE_EDGE_SOFT = 'rgba(110, 195, 185, 0.07)';

function renderChatDateSeparator(label, withTopGap) {
  return (
    <View style={{ alignItems: 'center', marginTop: withTopGap ? 12 : 0, marginBottom: 12 }}>
      <View style={[tw`rounded-[20px] px-3 py-1`, { backgroundColor: V.bgSurface }]}>
        <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

const BubbleMaterial = React.memo(function BubbleMaterial({
  bubbleMaxW,
  alignSelf,
  bubbleRadii,
  isEphemeral,
  selectionMode,
  onPress,
  onLongPress,
  children,
}) {
  const hasHandlers = !!onPress || !!onLongPress;
  return (
    <View
      collapsable={false}
      style={{
        maxWidth: bubbleMaxW,
        alignSelf,
        shadowColor: 'rgba(72, 200, 190, 0.28)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: Platform.OS === 'ios' ? 0.11 : 0,
        shadowRadius: 8,
        elevation: Platform.OS === 'android' ? 2 : 0,
      }}
    >
      <View
        collapsable={false}
        style={[
          bubbleRadii,
          {
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth * 1.5,
            borderColor: BUBBLE_EDGE_SOFT,
          },
        ]}
      >
        <BubbleSkiaGradient colors={V.inBubbleGradient} />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.04)' }]}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '38%',
            backgroundColor: 'rgba(0,0,0,0.03)',
          }}
        />
        {hasHandlers ? (
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={400}
            style={({ pressed }) => [
              {
                minWidth: 60,
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: 'transparent',
                opacity: pressed && !selectionMode ? 0.88 : 1,
                zIndex: 2,
              },
              isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold },
            ]}
          >
            {children}
          </Pressable>
        ) : (
          <View
            style={[
              {
                minWidth: 60,
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: 'transparent',
                zIndex: 2,
              },
              isEphemeral && { borderWidth: 0.5, borderColor: V.accentGold },
            ]}
          >
            {children}
          </View>
        )}
      </View>
    </View>
  );
});

/** Иконки скрепки / микрофона / отправки */
const INPUT_BAR_ICON = TAB_BAR_LAYOUT.iconSize;
/** Смайлик крупнее иконок вкладок */
const INPUT_BAR_EMOJI_ICON = TAB_BAR_LAYOUT.iconSize + 5;
/** Сдвиг скрепки и микрофона вправо относительно поля текста */
const INPUT_BAR_CLIP_MIC_SHIFT = 6;
/** Внешнее кольцо вокруг blur — объём без тени (токен V.sageSubtle, blur без изменений) */
const INPUT_CAPSULE_DEPTH_OUTSET = 2;
/** Визуально совпадает с frosted-шапкой (ChatRoomHeader.js) */
const INPUT_BAR_BLUR_INTENSITY_IOS = 78;
const INPUT_BAR_BLUR_INTENSITY_ANDROID = 56;
const INPUT_BAR_FROST_TINT_OPACITY = 0.28;

/** Ширина слота под VoiceRecorder (внешнее кольцо микрофона 52px, см. VoiceRecorder) */
const MIC_BUTTON_SIZE = 52;

/** Ключ объекта в Storage: только безопасные символы; `room_id` может быть с кириллицей и т.д. */
function storageRoomSegment(roomId) {
  return CryptoJS.SHA256(String(roomId)).toString(CryptoJS.enc.Hex);
}

/** RN `fetch(content://|file://)` часто не читает файл; Expo `File.bytes()` обычно срабатывает. */
async function readUriAsArrayBuffer(uri) {
  try {
    const f = new ExpoFile(uri);
    const bytes = await f.bytes();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (e) {
    console.warn('readUriAsArrayBuffer: File.bytes failed, trying fetch', e);
  }
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`fetch ${res.status}`);
  }
  return res.arrayBuffer();
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const EPHEMERAL_OPTIONS = [
  { label: 'Выкл', value: null },
  { label: '5с', value: 5 },
  { label: '30с', value: 30 },
  { label: '1м', value: 60 },
  { label: '5м', value: 300 },
];

const EMOJI_SET = [
  '😀','😃','😄','😁','😂','🤣','😊','😇','😉','😍',
  '🥰','😘','😎','🤩','🤔','😏','🙄','😒','😤','😡',
  '🤬','😱','😨','😢','😭','🥺','😴','🤮','🤯','🥳',
  '😈','👍','👎','👋','✌️','🤞','👊','✊','🤝','👏',
  '🙌','💪','🤙','👌','🤘','🫡','❤️','🧡','💛','💚',
  '💙','💜','🖤','💔','💯','💥','🔥','⭐','💫','🎉',
  '🎊','🎮','🎲','🏆','🏅','⚡','💣','💀','👑','💎',
  '🎯','🚀',
];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
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
function messageRowContentSig(m) {
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
 */
function buildFormattedMessagesCached(messages, cache) {
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

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Длительность из подписи `🎤 m:ss` для таймера без активного нативного статуса. */
function parseVoiceCaptionDurationSec(text) {
  if (!text || typeof text !== 'string') return 0;
  const m = text.match(/🎤\s*(\d+):(\d{2})/);
  if (!m) return 0;
  const min = parseInt(m[1], 10);
  const sec = parseInt(m[2], 10);
  if (!Number.isFinite(min) || !Number.isFinite(sec)) return 0;
  return min * 60 + sec;
}

function ReadCheck({ isRead, isMine }) {
  if (!isMine) return null;
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      {isRead
        ? <CheckCheck size={13} color={V.accentSage} strokeWidth={1.5} />
        : <Check size={13} color={V.textMuted} strokeWidth={1.5} />
      }
    </View>
  );
}

function ReplyPreview({ replyMsg }) {
  if (!replyMsg) return null;
  return (
    <View
      style={[
        tw`rounded-[8px] px-2.5 py-1.5 mb-1`,
        {
          backgroundColor: 'rgba(37,42,53,0.5)',
          borderLeftWidth: 2,
          borderLeftColor: V.accentSage,
        },
      ]}
    >
      <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]} numberOfLines={1}>
        {replyMsg.player_name}
      </Text>
      <Text style={[tw`text-[10px]`, { color: V.textSecondary }]} numberOfLines={1}>
        {replyMsg.text}
      </Text>
    </View>
  );
}

let ephemeralListTick = 0;
const ephemeralListTickListeners = new Set();
let ephemeralListTickInterval = null;

function subscribeEphemeralListTick(listener) {
  ephemeralListTickListeners.add(listener);
  if (ephemeralListTickListeners.size === 1 && ephemeralListTickInterval == null) {
    ephemeralListTickInterval = setInterval(() => {
      ephemeralListTick += 1;
      ephemeralListTickListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    ephemeralListTickListeners.delete(listener);
    if (ephemeralListTickListeners.size === 0 && ephemeralListTickInterval != null) {
      clearInterval(ephemeralListTickInterval);
      ephemeralListTickInterval = null;
    }
  };
}

function getEphemeralListTickSnapshot() {
  return ephemeralListTick;
}

function getEphemeralListTickServerSnapshot() {
  return 0;
}

function ReactionsBar({ reactions, onReact }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  return (
    <View style={tw`flex-row flex-wrap mt-0.5 gap-1`}>
      {Object.entries(reactions).map(([emoji, users]) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => onReact(emoji)}
          style={[
            tw`flex-row items-center rounded-full px-1.5 py-0.5`,
            { backgroundColor: V.bgElevated },
          ]}
        >
          <Text style={tw`text-[10px]`}>{emoji}</Text>
          {users.length > 1 && (
            <Text style={[tw`text-[10px] ml-0.5`, { color: V.textSecondary }]}>{users.length}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EphemeralCountdown({ expiresAt }) {
  const tick = useSyncExternalStore(
    subscribeEphemeralListTick,
    getEphemeralListTickSnapshot,
    getEphemeralListTickServerSnapshot
  );
  const secsLeft = useMemo(
    () => Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 1000)),
    [expiresAt, tick]
  );

  if (secsLeft <= 0) return null;
  const fmt = secsLeft >= 60 ? `${Math.floor(secsLeft / 60)}м ${secsLeft % 60}с` : `${secsLeft}с`;
  return (
    <View style={tw`flex-row items-center ml-1`}>
      <Flame size={9} color={V.accentGold} strokeWidth={1.5} />
      <Text style={[tw`text-[9px] ml-0.5`, { color: V.accentGold }]}>{fmt}</Text>
    </View>
  );
}

/** Fallback, если метринг не дал сэмплов — всё равно пишем в БД непустой jsonb. */
const DEFAULT_VOICE_WAVEFORM = () => Array.from({ length: 40 }, () => 10);

const VOICE_WAVE_DIM = 'rgba(90,158,154,0.3)';
const VOICE_WAVE_BAR_TARGET = 40;
const VOICE_WAVE_GAP = 2;

function coerceWaveformToNumberArray(raw) {
  if (raw == null) return null;
  let v = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    if (keys.length > 0) return keys.map((k) => v[k]);
  }
  return null;
}

function parseStoredVoiceWaveform(raw) {
  const arr = coerceWaveformToNumberArray(raw);
  if (!arr) return null;
  const nums = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  const maxV = Math.max(...nums.map((n) => Math.abs(n)));
  const heights =
    maxV <= 1.01
      ? nums.map((a) => Math.max(4, Math.min(40, a * 40)))
      : nums.map((h) => Math.max(4, Math.min(40, h)));
  return boostWaveformContrast(resampleVoiceHeightsTo40(heights));
}

function resampleVoiceHeightsTo40(heights) {
  const TARGET = VOICE_WAVE_BAR_TARGET;
  if (heights.length === TARGET) return heights;
  if (heights.length === 0) return Array(TARGET).fill(4);
  if (heights.length < TARGET) {
    const out = [...heights];
    const pad = out[out.length - 1] ?? 4;
    while (out.length < TARGET) out.push(pad);
    return out.slice(0, TARGET);
  }
  const out = [];
  for (let i = 0; i < TARGET; i++) {
    const t0 = (i / TARGET) * heights.length;
    const t1 = ((i + 1) / TARGET) * heights.length;
    let mx = 4;
    for (let j = Math.floor(t0); j < Math.ceil(t1) && j < heights.length; j++) {
      mx = Math.max(mx, heights[j] ?? 4);
    }
    out.push(Math.min(40, mx));
  }
  return out;
}

function boostWaveformContrast(heights) {
  if (!heights?.length) return heights;
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const spread = Math.max(max - min, 0.5);
  return heights.map((h) => {
    const t = (h - min) / spread;
    const shaped = Math.pow(Math.min(1, Math.max(0, t)), 0.55);
    return Math.round(6 + shaped * 30);
  });
}

function VoiceWaveformBars({ heights, progress, idle }) {
  const [trackW, setTrackW] = useState(0);
  const list = heights.length > 0 ? heights : Array(VOICE_WAVE_BAR_TARGET).fill(4);
  const n = list.length;
  const barW = trackW > 0 && n > 0 ? Math.max(2, (trackW - (n - 1) * VOICE_WAVE_GAP) / n) : 3;
  const p = Math.min(1, Math.max(0, progress));
  const playedEnd = idle ? 0 : Math.min(n, Math.floor(p * n + 1e-6));
  return (
    <View
      style={{ flex: 1, height: 40, justifyContent: 'flex-end', minWidth: 0 }}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 40 }}>
        {list.map((h, i) => (
          <View
            key={`wv-${i}`}
            style={{
              width: barW,
              height: Math.min(40, Math.max(4, h)),
              marginRight: i === n - 1 ? 0 : VOICE_WAVE_GAP,
              borderRadius: 2,
              backgroundColor: idle ? VOICE_WAVE_DIM : i < playedEnd ? V.accentSage : VOICE_WAVE_DIM,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Расширение локального кэша на Android — должно совпадать с форматом файла, иначе декодер не подхватит. */
function voiceCacheExtensionFromUrl(mediaUrl) {
  try {
    const noQuery = mediaUrl.split('?')[0];
    const base = noQuery.split('/').pop() || '';
    const dot = base.lastIndexOf('.');
    if (dot <= 0 || dot >= base.length - 1) return 'm4a';
    const ext = base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ext || ext.length > 8) return 'm4a';
    const allowed = new Set([
      'm4a',
      'aac',
      'mp3',
      'wav',
      'caf',
      'webm',
      'ogg',
      'opus',
      '3gp',
      'amr',
    ]);
    return allowed.has(ext) ? ext : 'm4a';
  } catch {
    return 'm4a';
  }
}

/** Минимальный разумный размер m4a после upload (иначе часто гонка «файл ещё не доступен по public URL»). */
const VOICE_CACHE_MIN_BYTES = 320;
const VOICE_CACHE_MAX_ATTEMPTS = 8;
const VOICE_CACHE_RETRY_MS = 400;

function normalizeDownloadedFileUri(fileUri) {
  if (
    fileUri &&
    typeof fileUri === 'string' &&
    !/^https?:/i.test(fileUri) &&
    !fileUri.startsWith('file:') &&
    !fileUri.startsWith('content:') &&
    fileUri.startsWith('/')
  ) {
    return `file://${fileUri}`;
  }
  return fileUri;
}

/** Размер с нативного моста / getters: не полагаемся на `typeof === 'number'`. */
function coerceFileSizeBytes(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

function voiceDownloadedFileSizeBytes(local) {
  let sz = coerceFileSizeBytes(local?.size);
  if (sz > 0) return sz;
  try {
    const uri = normalizeDownloadedFileUri(local?.uri);
    if (!uri || /^https?:/i.test(uri)) return 0;
    const f = new ExpoFile(uri);
    return coerceFileSizeBytes(f.size);
  } catch {
    return 0;
  }
}

/** Любой HTTPS: качаем в cache `file://` (iOS + Android) — стабильный источник для expo-audio / декодера. */
function useVoicePlayerResolvedUri(mediaUrl) {
  const [resolved, setResolved] = useState(() => {
    if (!mediaUrl || typeof mediaUrl !== 'string') return mediaUrl ?? null;
    if (/^https?:\/\//i.test(mediaUrl)) return null;
    return mediaUrl;
  });

  useEffect(() => {
    if (!mediaUrl || typeof mediaUrl !== 'string') {
      setResolved(null);
      return;
    }
    if (!/^https?:\/\//i.test(mediaUrl)) {
      setResolved(mediaUrl);
      return;
    }
    let cancelled = false;
    setResolved(null);
    (async () => {
      try {
        const hash = CryptoJS.SHA256(mediaUrl).toString(CryptoJS.enc.Hex).slice(0, 24);
        const ext = voiceCacheExtensionFromUrl(mediaUrl);
        const dest = new ExpoFile(Paths.cache, `voice-${hash}.${ext}`);
        let fileUri = null;
        for (let attempt = 0; attempt < VOICE_CACHE_MAX_ATTEMPTS; attempt++) {
          if (cancelled) return;
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, VOICE_CACHE_RETRY_MS));
          }
          const local = await ExpoFile.downloadFileAsync(mediaUrl, dest, { idempotent: true });
          const sz = voiceDownloadedFileSizeBytes(local);
          let u = local.uri;
          u = normalizeDownloadedFileUri(u);
          if (sz >= VOICE_CACHE_MIN_BYTES && u) {
            fileUri = u;
            break;
          } else if (sz < VOICE_CACHE_MIN_BYTES) {
            try {
              const preview = await ExpoFile.readAsStringAsync(dest.uri, {
                length: 300,
                position: 0,
                encoding: 'utf8',
              });
              console.warn('[voice] small file preview (attempt ' + attempt + '):', preview);
            } catch (readErr) {
              console.warn('[voice] small file, could not read preview:', readErr?.message);
            }
          }
        }
        if (!cancelled) {
          if (fileUri) setResolved(fileUri);
          else {
            console.warn('[voice] cache file too small after retries, fallback remote URL');
            setResolved(mediaUrl);
          }
        }
      } catch (e) {
        console.warn('[voice] cache download failed, fallback remote URL:', e);
        if (!cancelled) setResolved(mediaUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaUrl]);

  return resolved;
}

function VoicePlayer({
  url,
  messageId,
  isRecordingVoice,
  waveformRaw,
  onPlay,
  activeVoiceUri,
  activePlayerStatus,
  idleDurationSec,
}) {
  const resolvedUri = useVoicePlayerResolvedUri(url);
  const parsedHeights = useMemo(
    () => parseStoredVoiceWaveform(waveformRaw),
    [typeof waveformRaw === 'string' ? waveformRaw : JSON.stringify(waveformRaw ?? null)]
  );
  const displayHeights = useMemo(
    () => parsedHeights ?? DEFAULT_VOICE_WAVEFORM(),
    [parsedHeights]
  );

  if (!url) return null;

  const preparingRemote =
    typeof url === 'string' && /^https?:\/\//i.test(url) && resolvedUri == null;

  if (preparingRemote) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 200,
          minHeight: TAB_BAR_INNER_ROW_H - 4,
          minWidth: 0,
        }}
      >
        <ActivityIndicator size="small" color={V.accentSage} />
        <View style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
          <VoiceWaveformBars heights={displayHeights} progress={0} idle />
        </View>
      </View>
    );
  }

  if (!resolvedUri) return null;

  const isActiveRow = activeVoiceUri != null && activeVoiceUri === resolvedUri;
  const isPlaying = isActiveRow && activePlayerStatus.playing;
  const duration = isActiveRow ? activePlayerStatus.duration : 0;
  const progress =
    isActiveRow && activePlayerStatus.duration > 0
      ? activePlayerStatus.currentTime / activePlayerStatus.duration
      : 0;

  return (
    <VoiceMessagePlayer
      resolvedUri={resolvedUri}
      messageId={messageId}
      waveformHeights={displayHeights}
      isPlaying={isPlaying}
      progress={progress}
      duration={duration}
      idleDurationSec={idleDurationSec}
      onPlay={onPlay}
      isRecordingVoice={isRecordingVoice}
    />
  );
}

const MessageRow = React.memo(
  function MessageRow({ item, index, listExtra, activePlayback, fmtLenRef, rowEnvRef, onMessagePress, onMessageLongPress }) {
    const env = rowEnvRef.current;
    const listLength = fmtLenRef.current;
    const isMine = item.player_name === env.nickname;
    const replyMsg = env.getReplyMessage(item.reply_to);
    const isVideoMessage = item.message_type === 'video';
    const messageRowAnims = env.ensureMessageAnims(item.id);
    const isEphemeral = !!item.expires_at;
    const isSelected = listExtra.selectionMode && env.selectedIds.has(item.id);

    const bounceAnim = useRef(new Animated.Value(1)).current;
    const bounceAnimVideo = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (isSelected) {
        bounceAnim.setValue(1.04);
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: true,
        }).start();
        bounceAnimVideo.setValue(1.04);
        Animated.spring(bounceAnimVideo, {
          toValue: 1,
          friction: 6,
          tension: 160,
          useNativeDriver: false,
        }).start();
      }
    }, [isSelected, bounceAnim, bounceAnimVideo]);

    let rowMarginBottom = 0;
    if (item._abovePlayerName != null) {
      if (!item._sameDay) rowMarginBottom = 10;
      else if (item._abovePlayerName === item.player_name) rowMarginBottom = 3;
      else rowMarginBottom = 10;
    }

    const bubbleMaxW = env.windowWidth * 0.75;

    const bubbleRadii = isMine
      ? {
          borderTopLeftRadius: BUBBLE_RADIUS,
          borderTopRightRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: BUBBLE_RADIUS,
          borderBottomRightRadius: BUBBLE_TAIL,
        }
      : {
          borderTopLeftRadius: BUBBLE_RADIUS,
          borderTopRightRadius: BUBBLE_RADIUS,
          borderBottomLeftRadius: BUBBLE_TAIL,
          borderBottomRightRadius: BUBBLE_RADIUS,
        };

    const isTextMessage = !item.message_type || item.message_type === 'text';
    const timeColor = isMine
      ? 'rgba(186, 222, 218, 0.52)'
      : 'rgba(168, 162, 152, 0.58)';
    const bodyColor = isMine ? '#C8DEDE' : V.inBubbleText;

    const timeMeta = (
      <>
        {isEphemeral && <EphemeralCountdown expiresAt={item.expires_at} />}
        <Text style={{ fontSize: TS_TEXT_SIZE, color: timeColor, fontWeight: '400' }}>
          {item._formattedTime}
        </Text>
        <ReadCheck isRead={!!item.read_at} isMine={isMine} />
      </>
    );

    const metaReserveNbsp =
      (isMine ? META_RESERVE_NBSP_OUTGOING : META_RESERVE_NBSP_INCOMING) +
      (isEphemeral ? META_RESERVE_NBSP_EPHEMERAL_EXTRA : 0);

    const videoEdgeStripStyle = { flex: 1, alignSelf: 'stretch' };
    /* Клип круга — только внутри VideoMessage (Animated.View + overflow: hidden). Здесь без overflow: hidden — иначе предок expo-video ломает композицию вместе с нативным драйвером на строке. */
    const videoCircleChrome = {
      borderRadius: 120,
      ...(isEphemeral ? { borderWidth: 0.5, borderColor: V.accentGold } : {}),
    };

    const bubbleInner = isTextMessage ? (
      <>
        <ReplyPreview replyMsg={replyMsg} />
        <View style={{ overflow: 'visible' }}>
          <Text
            style={{
              fontSize: MSG_TEXT_SIZE,
              fontWeight: '400',
              lineHeight: MSG_LINE_HEIGHT,
              color: bodyColor,
            }}
          >
            {item.text}
            <Text
              style={{
                fontSize: TS_TEXT_SIZE,
                color: bodyColor,
                opacity: 0,
                lineHeight: MSG_LINE_HEIGHT,
              }}
            >
              {'\u00A0'.repeat(metaReserveNbsp)}
            </Text>
          </Text>
          <View
            style={{
              position: 'absolute',
              right: -5,
              bottom: 2,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {timeMeta}
          </View>
        </View>
      </>
    ) : isVideoMessage ? (
      <>
        <ReplyPreview replyMsg={replyMsg} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            width: '100%',
            alignSelf: 'stretch',
          }}
        >
          {isMine ? (
            <>
              <Pressable
                style={videoEdgeStripStyle}
                onPress={() => onMessagePress(item)}
                onLongPress={() => onMessageLongPress(item)}
                delayLongPress={400}
              />
              <Animated.View style={{ transform: [{ scale: bounceAnimVideo }] }}>
                <View style={{ ...videoCircleChrome, alignSelf: 'flex-start' }}>
                  {env.renderMessageContent(item, isMine)}
                </View>
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View style={{ transform: [{ scale: bounceAnimVideo }] }}>
                <View style={{ ...videoCircleChrome, alignSelf: 'flex-start' }}>
                  {env.renderMessageContent(item, isMine)}
                </View>
              </Animated.View>
              <Pressable
                style={videoEdgeStripStyle}
                onPress={() => onMessagePress(item)}
                onLongPress={() => onMessageLongPress(item)}
                delayLongPress={400}
              />
            </>
          )}
        </View>
      </>
    ) : (
      <>
        <ReplyPreview replyMsg={replyMsg} />
        {env.renderMessageContent(item, isMine)}
        <View style={tw`flex-row items-center justify-end mt-0.5 gap-1`}>
          {timeMeta}
        </View>
      </>
    );

    return (
      <View style={{ marginBottom: rowMarginBottom, zIndex: index }}>
        {item._showDate &&
          renderChatDateSeparator(item._dateLabel, index < listLength - 1)}
        {isVideoMessage ? (
          <View>
            {/*
              Нативный VideoView плохо композится под предком с useNativeDriver (opacity/transform) и/или при removeClippedSubviews на inverted FlatList после смены layout — слой рисования пустой, hit-testing остаётся.
              Видеоряд без opacity/scale на обёртке строки (анимация появления нового сообщения для video не на этой обёртке).
            */}
            <View
              style={[
                tw`${isMine ? 'items-end' : 'items-start'} px-4`,
                isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
              ]}
            >
              {!isMine && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    marginBottom: 3,
                    marginLeft: 4,
                    color: V.accentSage,
                  }}
                  numberOfLines={1}
                >
                  {item.player_name}
                </Text>
              )}
              {isMine ? (
                <View style={{ width: '100%', alignSelf: 'stretch' }}>
                  <View style={{ alignSelf: 'flex-end', width: '100%' }}>{bubbleInner}</View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      paddingHorizontal: 4,
                      marginTop: 2,
                    }}
                  >
                    {timeMeta}
                  </View>
                </View>
              ) : (
                <View style={{ width: '100%', alignSelf: 'stretch' }}>
                  <View style={{ alignSelf: 'flex-start', width: '100%' }}>{bubbleInner}</View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-start',
                      paddingHorizontal: 4,
                      marginTop: 2,
                    }}
                  >
                    {timeMeta}
                  </View>
                </View>
              )}
              <ReactionsBar
                reactions={item.reactions}
                onReact={(emoji) =>
                  listExtra.selectionMode
                    ? onMessagePress(item)
                    : env.toggleReaction(item.id, emoji)
                }
              />
            </View>
          </View>
        ) : (
          <Animated.View
            style={{
              opacity: messageRowAnims.opacity,
              transform: [{ scale: messageRowAnims.scale }],
            }}
          >
            <Pressable
              onPress={() => onMessagePress(item)}
              onLongPress={() => onMessageLongPress(item)}
              delayLongPress={400}
              style={{ width: '100%' }}
            >
              <View
                style={[
                  tw`${isMine ? 'items-end' : 'items-start'} px-4`,
                  isSelected && { backgroundColor: MESSAGE_ROW_SELECTION_BG },
                ]}
              >
            {!isMine && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  marginBottom: 3,
                  marginLeft: 4,
                  color: V.accentSage,
                }}
                numberOfLines={1}
              >
                {item.player_name}
              </Text>
            )}
            <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
              {isMine ? (
                <OutgoingBubble
                  message={item}
                  bubbleMaxW={bubbleMaxW}
                  bubbleRadii={bubbleRadii}
                  isEphemeral={isEphemeral}
                  isSelected={false}
                  selectionMode={listExtra.selectionMode}
                >
                  {bubbleInner}
                </OutgoingBubble>
              ) : (
                <BubbleMaterial
                  bubbleMaxW={bubbleMaxW}
                  alignSelf="flex-start"
                  bubbleRadii={bubbleRadii}
                  isEphemeral={isEphemeral}
                  selectionMode={listExtra.selectionMode}
                >
                  {bubbleInner}
                </BubbleMaterial>
              )}
            </Animated.View>
            <ReactionsBar
              reactions={item.reactions}
              onReact={(emoji) =>
                listExtra.selectionMode
                  ? onMessagePress(item)
                  : env.toggleReaction(item.id, emoji)
              }
            />
              </View>
            </Pressable>
          </Animated.View>
        )}
      </View>
    );
  },
  (prev, next) => {
    // Voice: перерендериваем только тот пузырь, который сейчас играет (по messageId, не по URI)
    const prevIsVoiceActive =
      prev.activePlayback?.activeVoiceMessageId != null &&
      prev.activePlayback.activeVoiceMessageId === prev.item.id;
    const nextIsVoiceActive =
      next.activePlayback?.activeVoiceMessageId != null &&
      next.activePlayback.activeVoiceMessageId === next.item.id;

    // Video: перерендериваем только активный видеопузырь
    const prevIsVideoActive =
      prev.activePlayback?.activeVideoId === prev.item.id &&
      prev.item.message_type === 'video';
    const nextIsVideoActive =
      next.activePlayback?.activeVideoId === next.item.id &&
      next.item.message_type === 'video';

    if (prevIsVoiceActive || nextIsVoiceActive || prevIsVideoActive || nextIsVideoActive) {
      // Этот item является активным медиа — всегда перерендерить
      return false;
    }

    // Неактивный item: изменения activePlayback игнорируем
    return (
      prev.item === next.item &&
      prev.index === next.index &&
      prev.listExtra === next.listExtra
    );
  }
);

export default function Chat({
  roomId,
  roomCode,
  nickname,
  compact = false,
  onInputBarHeight,
  onInputBarTopY,
  /** Отступ сверху у ленты (под «парящую» шапку с blur), px */
  listPaddingTop,
  /** Данные для frosted-шапки (рендер внутри Chat); если null — шапки нет. */
  chatRoomHeader,
  onTopOverlayHeight,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const inputBarRef = useRef(null);
  const [inputBarH, setInputBarH] = useState(0);
  const [bottomOverlayH, setBottomOverlayH] = useState(0);

  const reportInputBar = useCallback((layoutH) => {
    if (typeof layoutH === 'number' && layoutH > 0) {
      setInputBarH(layoutH);
      onInputBarHeight?.(layoutH);
    }
    inputBarRef.current?.measureInWindow((x, y) => {
      if (typeof y === 'number') onInputBarTopY?.(y);
    });
  }, [onInputBarHeight, onInputBarTopY]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [messageActionTarget, setMessageActionTarget] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [ephemeralSec, setEphemeralSec] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  const {
    play: handleVoicePlay,
    activeUri: activeVoiceUri,
    status: activePlayerStatus,
    pause: pauseVoice,
  } = useVoicePlayer();

  const [activeVideoId, setActiveVideoId] = useState(null);
  const activatedVideoIds = useRef(new Set());
  const [activeVoiceMessageId, setActiveVoiceMessageId] = useState(null);

  const flatListRef = useRef(null);
  /** Пользователь у низа inverted-ленты — при новых сообщениях держим offset 0. */
  const stickToBottomRef = useRef(true);
  /** FlatList уже отрисовал контент (onContentSizeChange). */
  const layoutReadyRef = useRef(false);
  /** Один раз после первого успешного initial scroll. */
  const initialScrollDoneRef = useRef(false);
  /** Сбрасывает подписку initial-эффекта после layout (ref сам по себе не триггерит ререндер). */
  const [layoutSignal, setLayoutSignal] = useState(0);
  const layoutStableRef = useRef(false);
  const pendingLayoutMutationsRef = useRef(0);

  const atBottomScrollShared = useSharedValue(1);

  const syncAtBottomFromWorklet = useCallback((atBottom) => {
    stickToBottomRef.current = atBottom;
  }, []);

  const onScrollReanimated = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const atBottom = y < CHAT_AT_BOTTOM_THRESHOLD_PX;
        const next = atBottom ? 1 : 0;
        if (next !== atBottomScrollShared.value) {
          atBottomScrollShared.value = next;
          runOnJS(syncAtBottomFromWorklet)(atBottom);
        }
      },
    },
    [syncAtBottomFromWorklet]
  );

  const messagesMap = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages]
  );

  const otherPlayerName = useMemo(
    () => messages.find((m) => m.player_name !== nickname)?.player_name ?? null,
    [messages, nickname]
  );
  const formattedMessagesCacheRef = useRef(new Map());
  const formattedMessages = useMemo(
    () => buildFormattedMessagesCached(messages, formattedMessagesCacheRef.current),
    [messages]
  );

  const selectedHash = useMemo(
    () => Array.from(selectedIds).sort().join(','),
    [selectedIds]
  );

  const rowEnvRef = useRef({});
  const fmtLenRef = useRef(0);
  const inputRef = useRef(null);
  const sendInProgressRef = useRef(false);
  const fadeAnims = useRef({}).current;
  const scaleAnims = useRef({}).current;

  const actionModalOpacity = useRef(new Animated.Value(0)).current;
  const actionModalScale = useRef(new Animated.Value(0.96)).current;
  const deletingIdsRef = useRef(deletingIds);
  useEffect(() => {
    deletingIdsRef.current = deletingIds;
  }, [deletingIds]);

  const cryptoKey = useRef(null);
  cryptoKey.current = roomCode ? deriveKey(roomCode) : null;

  const keyboardPadding = useRef(new Animated.Value(0)).current;
  const emojiWobbleRotate = useRef(new Animated.Value(0)).current;

  const playEmojiWobble = useCallback(() => {
    emojiWobbleRotate.setValue(0);
    Animated.sequence([
      Animated.timing(emojiWobbleRotate, { toValue: -12, duration: 80, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 12, duration: 100, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: -7, duration: 90, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 7, duration: 70, useNativeDriver: true }),
      Animated.timing(emojiWobbleRotate, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [emojiWobbleRotate]);

  useEffect(() => {
    const id = setInterval(playEmojiWobble, 5000);
    return () => clearInterval(id);
  }, [playEmojiWobble]);

  useEffect(() => {
    if (!isRecordingVoice) return;
    pauseVoice();
  }, [isRecordingVoice, pauseVoice]);

  // Сбрасываем activeVoiceMessageId когда плеер останавливается
  useEffect(() => {
    if (!activeVoiceUri) setActiveVoiceMessageId(null);
  }, [activeVoiceUri]);

  useEffect(() => {
    const initE2E = async () => {
      try {
        await getOrCreateKeyPair();
        await publishMyPublicKey(nickname);
      } catch (e) {
        console.warn('[Vault E2E] Ошибка инициализации ключей:', e?.message);
      }
    };
    if (nickname) initE2E();
  }, [nickname]);

  useEffect(() => {
    pauseVoice();
    if (!roomId) {
      formattedMessagesCacheRef.current.clear();
      return;
    }
    atBottomScrollShared.value = 1;
    stickToBottomRef.current = true;
    layoutReadyRef.current = false;
    initialScrollDoneRef.current = false;
    pendingLayoutMutationsRef.current = 0;
    layoutStableRef.current = false;
    formattedMessagesCacheRef.current.clear();
  }, [roomId, pauseVoice]);

  useEffect(() => {
    if (!roomId) return;
    if (initialScrollDoneRef.current) return;
    if (!layoutReadyRef.current && messages.length > 0) return;

    initialScrollDoneRef.current = true;
  }, [roomId, layoutSignal, messages]);

  useEffect(() => {
    if (pendingLayoutMutationsRef.current === 0) {
      layoutStableRef.current = true;
      return;
    }

    const id = requestAnimationFrame(() => {
      pendingLayoutMutationsRef.current -= 1;

      if (pendingLayoutMutationsRef.current <= 0) {
        layoutStableRef.current = true;
        pendingLayoutMutationsRef.current = 0;
      } else {
        setLayoutSignal((s) => s + 1);
      }
    });

    return () => cancelAnimationFrame(id);
  }, [layoutSignal]);

  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    if (!layoutStableRef.current) return;

    const shouldStickToBottom = stickToBottomRef.current;

    const id = requestAnimationFrame(() => {
      if (shouldStickToBottom) {
        flatListRef.current?.scrollToOffset({
          offset: 0,
          animated: false,
        });
      }
    });

    return () => cancelAnimationFrame(id);
  }, [messages, layoutSignal]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub1 = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(keyboardPadding, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    });
    const sub2 = Keyboard.addListener(hideEvt, () => {
      Animated.timing(keyboardPadding, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  /* ── Decrypt helpers ── */

  const decryptMsg = useCallback(async (msg) => {
    const raw = msg.text;
    if (!raw) return msg;

    // Уровень 1: новый формат Vault E2E
    if (isVaultEncrypted(raw)) {
      try {
        const plain = await decryptMessage(raw, msg.player_name);
        if (plain !== null) return { ...msg, text: plain };
      } catch {}
    }

    // Уровень 2: старый формат CryptoJS (обратная совместимость)
    if (looksLikeEncryptedPayload(raw) && cryptoKey.current) {
      const plain = decrypt(raw, cryptoKey.current);
      if (plain) return { ...msg, text: plain };
    }

    // Уровень 3: plaintext
    return msg;
  }, []);

  const decryptBatch = useCallback(
    async (msgs) => {
      const CHUNK = 10;
      const result = [];
      for (let i = 0; i < msgs.length; i += CHUNK) {
        const chunk = msgs.slice(i, i + CHUNK);
        const decrypted = await Promise.all(chunk.map((m) => decryptMsg(m)));
        result.push(...decrypted);
      }
      return result;
    },
    [decryptMsg]
  );

  const filterExpired = useCallback((msgs) => {
    const now = Date.now();
    return msgs.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
  }, []);

  const filterHiddenForMe = useCallback(
    (msgs) => msgs.filter((m) => !(m.hidden_for || []).includes(nickname)),
    [nickname]
  );

  const filterHiddenForMeKeepingDeleting = useCallback(
    (msgs) =>
      msgs.filter((m) => {
        const hidden = (m.hidden_for || []).includes(nickname);
        if (!hidden) return true;
        return deletingIdsRef.current?.has?.(m.id);
      }),
    [nickname]
  );

  const ensureMessageAnims = useCallback(
    (id) => {
      if (!fadeAnims[id]) fadeAnims[id] = new Animated.Value(1);
      if (!scaleAnims[id]) scaleAnims[id] = new Animated.Value(1);
      return { opacity: fadeAnims[id], scale: scaleAnims[id] };
    },
    [fadeAnims, scaleAnims]
  );

  const popMessage = useCallback(
    (id, opts = {}) => {
      const { opacity, scale } = ensureMessageAnims(id);
      const duration = opts.duration ?? 180;
      const toScale = opts.toScale ?? 0.6;
      return new Promise((resolve) => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }),
          Animated.timing(scale, { toValue: toScale, duration, useNativeDriver: true }),
        ]).start(({ finished }) => resolve(!!finished));
      });
    },
    [ensureMessageAnims]
  );

  useEffect(() => {
    const currentIds = new Set(messages.map((m) => m.id));
    Object.keys(fadeAnims).forEach((id) => {
      if (!currentIds.has(id)) {
        delete fadeAnims[id];
        delete scaleAnims[id];
      }
    });
  }, [messages, fadeAnims, scaleAnims]);

  /* ── Load & subscribe ── */

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (cancelled || !data) return;
      const decrypted = await decryptBatch(data);
      setMessages(filterHiddenForMeKeepingDeleting(filterExpired(decrypted)));
    };
    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [roomId, roomCode, filterHiddenForMeKeepingDeleting, decryptBatch, filterExpired]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = await decryptMsg(payload.new);
            if (msg.expires_at && new Date(msg.expires_at).getTime() <= Date.now()) return;
            if ((msg.hidden_for || []).includes(nickname)) return;
            fadeAnims[msg.id] = new Animated.Value(0);
            scaleAnims[msg.id] = new Animated.Value(0.85);
            Animated.parallel([
              Animated.timing(fadeAnims[msg.id], { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.spring(scaleAnims[msg.id], {
                toValue: 1,
                friction: 8,
                tension: 120,
                useNativeDriver: true,
              }),
            ]).start();
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) {
                return filterHiddenForMeKeepingDeleting(filterExpired(prev));
              }
              return filterHiddenForMeKeepingDeleting(filterExpired([...prev, msg]));
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = await decryptMsg(payload.new);
            setMessages((prev) => {
              const next = prev.map((m) => (m.id === payload.new.id ? updatedMsg : m));
              return filterHiddenForMeKeepingDeleting(filterExpired(next));
            });
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id;
            if (deletingIdsRef.current?.has?.(id)) return;
            setMessages((prev) => prev.filter((m) => m.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, decryptMsg, nickname, filterHiddenForMeKeepingDeleting, filterExpired]);

  useEffect(() => {
    const hasEphemeral = messages.some((m) => m.expires_at);
    if (!hasEphemeral) return;
    const timer = setInterval(() => {
      setMessages((prev) => {
        const filtered = filterExpired(prev);
        if (filtered.length !== prev.length) {
          const expiredIds = prev
            .filter((m) => m.expires_at && new Date(m.expires_at).getTime() <= Date.now())
            .map((m) => m.id);
          if (expiredIds.length > 0) supabase.from('messages').delete().in('id', expiredIds).then();
          return filtered;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [messages.length]);

  useEffect(() => {
    if (!roomId || !nickname) return;
    const unread = messages.filter((m) => m.player_name !== nickname && !m.read_at);
    if (unread.length > 0) {
      const ids = unread.map((m) => m.id);
      supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then();
    }
  }, [messages, nickname, roomId]);

  /* ── Media upload ── */

  const uploadMedia = useCallback(async (uri, folder, ext, contentType) => {
    if (!roomId) {
      throw new Error('room_id отсутствует');
    }
    const filePath = `${folder}/${storageRoomSegment(roomId)}/${Date.now()}.${ext}`;
  
    const arrayBuffer = await readUriAsArrayBuffer(uri);
  
    const { error } = await supabase.storage
      .from('chat-media')
      .upload(filePath, arrayBuffer, { contentType, upsert: false });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);
    return publicUrl;
  }, [roomId]);

  const sendMediaMessage = useCallback(async (messageType, mediaUrl, extra = {}) => {
    const rawText = extra.text || '';
    const row = {
      room_id: roomId,
      player_name: nickname,
      text: rawText && cryptoKey.current ? encrypt(rawText, cryptoKey.current) : rawText,
      message_type: messageType,
      media_url: mediaUrl || null,
      latitude: extra.latitude ?? null,
      longitude: extra.longitude ?? null,
      reply_to: replyTo?.id || null,
    };
    if (ephemeralSec) {
      row.expires_at = new Date(Date.now() + ephemeralSec * 1000).toISOString();
    }
    if (messageType === 'voice' || messageType === 'audio') {
      const wf = extra.waveform;
      row.waveform = Array.isArray(wf) && wf.length > 0 ? [...wf] : DEFAULT_VOICE_WAVEFORM();
    } else if (extra.waveform !== undefined) {
      row.waveform = extra.waveform;
    }
    const { data, error } = await supabase.from('messages').insert(row).select('*').single();
    if (error) {
      console.warn('Chat media insert error:', error.message);
      throw error;
    }
    setReplyTo(null);
    return data ?? null;
  }, [roomId, nickname, replyTo, ephemeralSec]);

  /* ── Image picker ── */

  const pickImageFromGallery = async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadMedia(result.assets[0].uri, 'images', 'jpg', 'image/jpeg');
      await sendMediaMessage('image', url);
    } catch (e) {
      const detail = e?.message || e?.error_description || String(e);
      Alert.alert('Ошибка', `Не удалось отправить фото.\n${detail}`);
      console.warn(e);
    }
    setUploading(false);
  };

  const takePhoto = async () => {
    setShowAttachMenu(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await uploadMedia(result.assets[0].uri, 'images', 'jpg', 'image/jpeg');
      await sendMediaMessage('image', url);
    } catch (e) {
      const detail = e?.message || e?.error_description || String(e);
      Alert.alert('Ошибка', `Не удалось отправить фото.\n${detail}`);
      console.warn(e);
    }
    setUploading(false);
  };

  /* ── Location ── */

  const sendCurrentLocation = async () => {
    setShowAttachMenu(false);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к геолокации в настройках');
      return;
    }
    setUploading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await sendMediaMessage('location', null, {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        text: 'Местоположение',
      });
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось определить местоположение');
      console.warn(e);
    }
    setUploading(false);
  };

  /* ── Voice recording (handled by VoiceRecorder component) ── */

  const handleSendVoice = useCallback(
    async (uri, duration, waveform) => {
      setUploading(true);
      try {
        const url = await uploadMedia(uri, 'voice', 'm4a', 'audio/m4a');
        const wf =
          Array.isArray(waveform) && waveform.length > 0 ? waveform : DEFAULT_VOICE_WAVEFORM();
        const inserted = await sendMediaMessage('voice', url, {
          text: `🎤 ${formatDuration(duration)}`,
          waveform: wf,
        });
        if (inserted?.id) {
          const msg = await decryptMsg(inserted);
          setMessages((prev) => {
            if (prev.some((m) => m.id === inserted.id)) return prev;
            return filterHiddenForMeKeepingDeleting(filterExpired([...prev, msg]));
          });
        }
      } catch (e) {
        const detail = e?.message || e?.error_description || String(e);
        Alert.alert('Ошибка', `Не удалось отправить голосовое.\n${detail}`);
        console.warn(e);
      }
      setUploading(false);
    },
    [
      uploadMedia,
      sendMediaMessage,
      decryptMsg,
      filterHiddenForMeKeepingDeleting,
      filterExpired,
    ]
  );

  /* ── Emoji ── */

  const toggleEmojiPicker = () => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setShowEmojiPicker(true);
    }
  };

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji);
  };

  /* ── Send text message ── */

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (sendInProgressRef.current) return;
    sendInProgressRef.current = true;
    const replySnapshot = replyTo;
    const replyId = replyTo?.id || null;
    let cipherText = trimmed;
    try {
      if (otherPlayerName) {
        cipherText = await encryptMessage(trimmed, otherPlayerName);
      }
    } catch (e) {
      console.warn('[Vault E2E] Ошибка шифрования, отправляем plaintext:', e?.message);
    }
    const row = {
      room_id: roomId,
      player_name: nickname,
      text: cipherText,
      reply_to: replyId,
    };
    if (ephemeralSec) {
      row.expires_at = new Date(Date.now() + ephemeralSec * 1000).toISOString();
    }
    setText('');
    setReplyTo(null);
    try {
      const { error } = await supabase.from('messages').insert(row);
      if (error) {
        console.warn('Chat insert error:', error.message);
        setText(trimmed);
        setReplyTo(replySnapshot);
        Alert.alert('Ошибка', error.message || 'Не удалось отправить сообщение');
      }
    } catch (e) {
      const detail = e?.message || String(e);
      console.warn('Chat insert error:', detail);
      setText(trimmed);
      setReplyTo(replySnapshot);
      Alert.alert('Ошибка', detail);
    } finally {
      sendInProgressRef.current = false;
    }
  }, [text, replyTo, roomId, nickname, ephemeralSec, otherPlayerName]);

  /* ── Reactions ── */

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      const reactions = { ...(msg.reactions || {}) };
      const users = reactions[emoji] || [];
      if (users.includes(nickname)) {
        reactions[emoji] = users.filter((u) => u !== nickname);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, nickname];
      }
      const { error } = await supabase.from('messages').update({ reactions }).eq('id', messageId);
      if (error) {
        Alert.alert('Ошибка', error.message || 'Не удалось поставить реакцию');
        return;
      }
      setMessageActionTarget(null);
    },
    [messages, nickname]
  );

  const getCopyText = (item) => {
    const type = item.message_type || 'text';
    if (type === 'image') return item.text?.trim() || '[Фото]';
    if (type === 'voice' || type === 'audio') return item.text?.trim() || '[Голосовое сообщение]';
    if (type === 'location' && item.latitude != null && item.longitude != null) {
      return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
    }
    return item.text || '';
  };

  const deleteMessageForMe = useCallback(
    async (messageId) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      setDeletingIds((prev) => new Set(prev).add(messageId));
      setMessageActionTarget(null);
      await popMessage(messageId, { duration: 200, toScale: 0.55 });
      const hidden = [...(msg.hidden_for || []), nickname];
      const { error } = await supabase
        .from('messages')
        .update({ hidden_for: hidden })
        .eq('id', messageId);
      if (error) {
        Alert.alert(
          'Не удалось скрыть сообщение',
          `${error.message}\n\nНужны политика RLS на UPDATE (scripts/fix-messages-rls-update-delete.sql) и колонка hidden_for (scripts/fix-messages-hidden.sql).`
        );
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    },
    [messages, nickname, popMessage]
  );

  const deleteMessageForAll = useCallback(async (messageId) => {
    setDeletingIds((prev) => new Set(prev).add(messageId));
    setMessageActionTarget(null);
    await popMessage(messageId, { duration: 200, toScale: 0.55 });

    // Вместо физического DELETE (который может не прилететь второму клиенту через Realtime),
    // делаем UPDATE hidden_for сразу для обоих участников комнаты.
    // Не указываем конкретные колонки: в разных версиях схемы они отличаются,
    // а PostgREST падает, если в select есть несуществующие поля.
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    const u1 = room?.user1_id || room?.player1_name || null;
    const u2 = room?.user2_id || room?.player2_name || null;
    const hiddenForAll = [...new Set([u1, u2].filter(Boolean))];
    if (hiddenForAll.length === 0) hiddenForAll.push(nickname);

    if (roomErr) {
      Alert.alert('Не удалось удалить у всех', roomErr.message);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      return;
    }

    const { error } = await supabase
      .from('messages')
      .update({ hidden_for: hiddenForAll })
      .eq('id', messageId);

    if (error) {
      Alert.alert(
        'Не удалось удалить у всех',
        `${error.message}\n\nНужна политика RLS на UPDATE (scripts/fix-messages-rls-update-delete.sql) и колонка hidden_for (scripts/fix-messages-hidden.sql).`
      );
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      return;
    }

    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }, [nickname, popMessage, roomId]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleMessagePress = useCallback(
    (item) => {
      if (selectionMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          if (next.size === 0) setSelectionMode(false);
          return next;
        });
        return;
      }
      setMessageActionTarget(item);
    },
    [selectionMode]
  );

  const handleMessageLongPress = useCallback((item) => {
    setMessageActionTarget(null);
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const batchDeleteForMe = useCallback(async () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Удалить у меня',
      `Скрыть ${selectedIds.size} сообщ. у вас?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const ids = [...selectedIds];
            const updates = new Map();
            let lastError = null;
            for (const id of ids) {
              const msg = messages.find((m) => m.id === id);
              if (!msg) continue;
              const hidden = [...(msg.hidden_for || []), nickname];
              const { error } = await supabase
                .from('messages')
                .update({ hidden_for: hidden })
                .eq('id', id);
              if (error) lastError = error;
              else updates.set(id, hidden);
            }
            if (updates.size > 0) {
              setMessages((prev) =>
                filterHiddenForMe(
                  filterExpired(
                    prev.map((m) => (updates.has(m.id) ? { ...m, hidden_for: updates.get(m.id) } : m))
                  )
                )
              );
            }
            if (lastError) {
              Alert.alert('Ошибка', lastError.message);
            }
            exitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, messages, nickname, exitSelectionMode, filterHiddenForMe, filterExpired]);

  const messageLineForCopy = useCallback(
    async (msg) => {
      const m = await decryptMsg(msg);
      const type = m.message_type || 'text';
      switch (type) {
        case 'text':
          return (m.text || '').trim() || ' ';
        case 'image':
          return '[Фото]';
        case 'voice':
        case 'audio':
          return '[Голосовое]';
        case 'video':
          return '[Видео]';
        case 'location':
          return '[Геолокация]';
        default:
          return '[Сообщение]';
      }
    },
    [decryptMsg]
  );

  const batchCopySelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const lines = [];
    for (let i = formattedMessages.length - 1; i >= 0; i--) {
      const item = formattedMessages[i];
      if (!selectedIds.has(item.id)) continue;
      lines.push(await messageLineForCopy(item));
    }
    const text = lines.join('\n\n');
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Скопировано', `${selectedIds.size} сообщ.`);
    } catch (e) {
      Alert.alert('Ошибка', e?.message || 'Не удалось скопировать');
    }
  }, [selectedIds, formattedMessages, messageLineForCopy]);

  const batchForwardSelected = useCallback(() => {
    Alert.alert('Переслать', 'Функция в разработке.');
  }, []);

  const getReplyMessage = useCallback(
    (replyToId) => (replyToId ? messagesMap.get(replyToId) ?? null : null),
    [messagesMap]
  );

  /* ── Renderers ── */

  const renderMessageContent = useCallback((item, isMine) => {
    const type = item.message_type || 'text';
    const bodyColor = isMine ? '#C8DEDE' : V.inBubbleText;
    const titleLocStyle = {
      fontSize: MSG_TEXT_SIZE,
      fontWeight: '500',
      lineHeight: MSG_LINE_HEIGHT,
      color: bodyColor,
    };
    const bodyTextStyle = {
      fontSize: MSG_TEXT_SIZE,
      fontWeight: '400',
      lineHeight: MSG_LINE_HEIGHT,
      color: bodyColor,
    };
    switch (type) {
      case 'image':
        return (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(item.media_url)}>
            <Image
              source={{ uri: item.media_url }}
              style={tw`w-52 h-52 rounded-[12px]`}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      case 'voice':
      case 'audio':
        return (
          <VoicePlayer
            url={item.media_url}
            messageId={item.id}
            isRecordingVoice={isRecordingVoice}
            waveformRaw={item.waveform}
            onPlay={(uri) => {
              setActiveVoiceMessageId(item.id);
              handleVoicePlay(uri);
            }}
            activeVoiceUri={activeVoiceUri}
            activePlayerStatus={activePlayerStatus}
            idleDurationSec={parseVoiceCaptionDurationSec(item.text)}
          />
        );
      case 'location':
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
              )
            }
            style={tw`flex-row items-center`}
          >
            <MapPin size={20} color={V.accentSage} strokeWidth={1.5} style={tw`mr-2`} />
            <View style={tw`flex-shrink`}>
              <Text style={titleLocStyle}>Местоположение</Text>
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>
                {item.latitude?.toFixed(5)}, {item.longitude?.toFixed(5)}
              </Text>
              <Text style={[tw`text-[10px] mt-0.5`, { color: V.accentSage }]}>
                Открыть в картах →
              </Text>
            </View>
          </TouchableOpacity>
        );
      case 'video':
        return (
          <VideoMessage
            url={item.media_url}
            messageId={item.id}
            activeVideoId={activeVideoId}
            wasActivated={activatedVideoIds.current.has(item.id)}
            onActivate={(id) => {
              if (id) activatedVideoIds.current.add(id);
              setActiveVideoId(id);
            }}
            onLongPress={() => onMessageLongPress(item)}
          />
        );
      default:
        return (
          <Text style={bodyTextStyle}>
            {item.text}
          </Text>
        );
    }
  }, [
    isRecordingVoice,
    handleVoicePlay,
    activeVoiceUri,
    activePlayerStatus,
    activeVideoId,
  ]);

  /** Меняется редко (выбор, мультиселект) — extraData FlatList, MessageRow.memo сравнивает по ссылке. */
  const listExtraDataStable = useMemo(
    () => ({ selectionMode, selectedHash }),
    [selectionMode, selectedHash]
  );

  /** Меняется каждые ~250ms при воспроизведении — передаётся отдельным пропом,
   *  memo comparator игнорирует его для неактивных пузырей. */
  const activePlayback = useMemo(
    () => ({ activeVoiceUri, activePlayerStatus, activeVideoId, isRecordingVoice, activeVoiceMessageId }),
    [activeVoiceUri, activePlayerStatus, activeVideoId, isRecordingVoice, activeVoiceMessageId]
  );

  const onMessagePress = useCallback((item) => {
    rowEnvRef.current.handleMessagePress(item);
  }, []);

  const onMessageLongPress = useCallback((item) => {
    rowEnvRef.current.handleMessageLongPress(item);
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => (
      <MessageRow
        item={item}
        index={index}
        listExtra={listExtraDataStable}
        activePlayback={activePlayback}
        fmtLenRef={fmtLenRef}
        rowEnvRef={rowEnvRef}
        onMessagePress={onMessagePress}
        onMessageLongPress={onMessageLongPress}
      />
    ),
    [listExtraDataStable, activePlayback, onMessagePress, onMessageLongPress]
  );

  useEffect(() => {
    if (messageActionTarget) {
      actionModalOpacity.setValue(0);
      actionModalScale.setValue(0.96);
      Animated.parallel([
        Animated.timing(actionModalOpacity, { toValue: 1, duration: 170, useNativeDriver: true }),
        Animated.timing(actionModalScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [messageActionTarget, actionModalOpacity, actionModalScale]);

  fmtLenRef.current = formattedMessages.length;
  rowEnvRef.current = {
    nickname,
    windowWidth,
    selectedIds,
    getReplyMessage,
    ensureMessageAnims,
    renderMessageContent,
    setFullScreenImage,
    handleMessagePress,
    handleMessageLongPress,
    toggleReaction,
    setActiveVideoId,
  };

  return (
    <Animated.View
      style={[
        tw`flex-1`,
        {
          backgroundColor: V.bgApp,
          paddingBottom: keyboardPadding,
          overflow: chatRoomHeader ? 'visible' : 'hidden',
        },
      ]}
    >
      <Image
        pointerEvents="none"
        source={CHAT_BG_PATTERN}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
        resizeMode="cover"
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          backgroundColor: 'rgba(0,0,0,0.50)',
        }}
      />
      <ChatBackgroundNoise />
      <LinearGradient
        colors={['rgba(90,158,154,0.09)', 'transparent']}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
        }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[V.sageBorder, V.sageSubtle, 'transparent']}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          opacity: 0.55,
        }}
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            backgroundColor: V.bgApp,
            opacity: 0.78,
          },
        ]}
      />
      {/* Upload overlay */}
      {uploading && (
        <View
          style={[
            tw`absolute inset-0 items-center justify-center z-50`,
            { backgroundColor: 'rgba(0,0,0,0.35)' },
          ]}
        >
          <View style={[tw`rounded-[12px] p-5 items-center`, { backgroundColor: V.bgElevated }]}>
            <ActivityIndicator size="large" color={V.accentSage} />
            <Text style={[tw`text-[10px] mt-2`, { color: V.textSecondary }]}>Отправка...</Text>
          </View>
        </View>
      )}

      {/* Full-screen image viewer */}
      <Modal
        visible={!!fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <Pressable
          style={tw`flex-1 bg-black items-center justify-center`}
          onPress={() => setFullScreenImage(null)}
        >
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={[
              tw`absolute top-12 right-4 rounded-full p-2`,
              { backgroundColor: 'rgba(0,0,0,0.5)' },
            ]}
            onPress={() => setFullScreenImage(null)}
          >
            <X size={18} color={V.textPrimary} strokeWidth={1.5} />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      {/* Действия с сообщением: реакции сверху, кнопки снизу */}
      <Modal
        visible={!!messageActionTarget}
        transparent
        animationType="none"
        onRequestClose={() => setMessageActionTarget(null)}
      >
        <View style={tw`flex-1 justify-center items-center`}>
          <Pressable
            style={[tw`absolute inset-0`, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={() => setMessageActionTarget(null)}
          />
          {messageActionTarget && (
            <Animated.View
              style={[
                tw`z-10 items-center px-5`,
                { width: '100%', maxWidth: 420, opacity: actionModalOpacity, transform: [{ scale: actionModalScale }] },
              ]}
            >
              <SafeBlurView
                intensity={20}
                tint="dark"
                blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
                style={[
                  tw`rounded-[14px] px-3 py-2.5 flex-row justify-center gap-2 mb-2`,
                  { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: V.border },
                ]}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => toggleReaction(messageActionTarget.id, emoji)}
                  >
                    <Text style={tw`text-2xl`}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </SafeBlurView>
              <SafeBlurView
                intensity={20}
                tint="dark"
                blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
                style={[
                  tw`rounded-[14px] overflow-hidden`,
                  { width: '51%' },
                  { borderWidth: 0.5, borderColor: V.border },
                ]}
              >
                <TouchableOpacity
                  style={tw`px-4 py-3`}
                  onPress={async () => {
                    const t = getCopyText(messageActionTarget);
                    await Clipboard.setStringAsync(t);
                    setMessageActionTarget(null);
                  }}
                >
                  <Text style={[tw`text-[14px] text-center`, { color: V.textPrimary }]}>Копировать</Text>
                </TouchableOpacity>
                <View style={[tw`h-[0.5px]`, { backgroundColor: V.border }]} />
                <TouchableOpacity
                  style={tw`px-4 py-3`}
                  onPress={() => deleteMessageForMe(messageActionTarget.id)}
                >
                  <Text style={[tw`text-[14px] text-center`, { color: V.textPrimary }]}>
                    Удалить у меня
                  </Text>
                </TouchableOpacity>
                {messageActionTarget.player_name === nickname && (
                  <>
                    <View style={[tw`h-[0.5px]`, { backgroundColor: V.border }]} />
                    <TouchableOpacity
                      style={tw`px-4 py-3`}
                      onPress={() => {
                        const id = messageActionTarget.id;
                        Alert.alert(
                          'Удалить у всех',
                          'Сообщение удалится у всех в чате.',
                          [
                            { text: 'Отмена', style: 'cancel' },
                            {
                              text: 'Удалить',
                              style: 'destructive',
                              onPress: () => {
                                deleteMessageForAll(id);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={[tw`text-[14px] text-center`, { color: V.dangerMuted }]}>
                        Удалить у всех
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                <View style={[tw`h-[0.5px]`, { backgroundColor: V.border }]} />
                <TouchableOpacity
                  style={tw`px-4 py-3`}
                  onPress={() => {
                    setReplyTo(messageActionTarget);
                    setMessageActionTarget(null);
                  }}
                >
                  <Text style={[tw`text-[14px] text-center`, { color: V.textPrimary }]}>Ответить</Text>
                </TouchableOpacity>
              </SafeBlurView>
            </Animated.View>
          )}
        </View>
      </Modal>

      {/* Attachment menu (bottom sheet) */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <Pressable
          style={[tw`flex-1 justify-end`, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          onPress={() => setShowAttachMenu(false)}
        >
          <Pressable style={[tw`rounded-t-[20px] px-6 pt-4 pb-8`, { overflow: 'hidden' }]}>
            <SafeBlurView
              intensity={20}
              tint="dark"
              blurReductionFactor={Platform.OS === 'android' ? 4.5 : 4}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  overflow: 'hidden',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: V.border,
                },
              ]}
            />
            <View style={[tw`w-10 h-1 rounded-full self-center mb-5`, { backgroundColor: V.textGhost }]} />

            <View style={tw`flex-row justify-around mb-6`}>
              <TouchableOpacity onPress={takePhoto} style={tw`items-center`}>
                <View
                  style={[
                    tw`w-14 h-14 rounded-full items-center justify-center mb-2`,
                    { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                  ]}
                >
                  <Camera size={20} color={V.textSecondary} strokeWidth={1.5} />
                </View>
                <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Камера</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={pickImageFromGallery} style={tw`items-center`}>
                <View
                  style={[
                    tw`w-14 h-14 rounded-full items-center justify-center mb-2`,
                    { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                  ]}
                >
                  <ImageIcon size={20} color={V.textSecondary} strokeWidth={1.5} />
                </View>
                <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Галерея</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={sendCurrentLocation} style={tw`items-center`}>
                <View
                  style={[
                    tw`w-14 h-14 rounded-full items-center justify-center mb-2`,
                    { backgroundColor: V.bgSurface, borderWidth: 0.5, borderColor: V.border },
                  ]}
                >
                  <MapPin size={20} color={V.textSecondary} strokeWidth={1.5} />
                </View>
                <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>Геолокация</Text>
              </TouchableOpacity>
            </View>

            {/* Ephemeral timer inside attach menu */}
            <View style={[tw`pt-4`, { borderTopWidth: 0.5, borderTopColor: V.border }]}>
              <View style={tw`flex-row items-center justify-center mb-2`}>
                <Timer size={14} color={V.textSecondary} strokeWidth={1.5} style={tw`mr-1`} />
                <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>
                  Сгорающие сообщения
                  {ephemeralSec
                    ? ` (${EPHEMERAL_OPTIONS.find((o) => o.value === ephemeralSec)?.label})`
                    : ''}
                </Text>
              </View>
              <View style={tw`flex-row justify-center gap-2`}>
                {EPHEMERAL_OPTIONS.map((opt) => {
                  const active = ephemeralSec === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      onPress={() => {
                        setEphemeralSec(opt.value);
                        setShowAttachMenu(false);
                      }}
                      style={[
                        tw`px-3 py-2 rounded-[10px]`,
                        {
                          backgroundColor: active ? V.btnPrimaryBg : V.bgSurface,
                          borderWidth: 0.5,
                          borderColor: active ? V.accentSage : V.border,
                        },
                      ]}
                    >
                      <Text style={[tw`text-[10px] font-medium`, { color: active ? V.accentSage : V.textSecondary }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Reanimated.FlatList
        ref={flatListRef}
        data={formattedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={listExtraDataStable}
        initialNumToRender={16}
        maxToRenderPerBatch={8}
        windowSize={12}
        onScroll={onScrollReanimated}
        scrollEventThrottle={32}
        decelerationRate={Platform.OS === 'ios' ? 0.992 : 'fast'}
        style={[
          tw`flex-1`,
          chatRoomHeader ? { backgroundColor: 'transparent' } : null,
          { zIndex: 1 },
        ]}
        removeClippedSubviews={false}
        ListFooterComponent={
          (() => {
            const needsTopSpacer =
              chatRoomHeader != null &&
              typeof listPaddingTop === 'number' &&
              listPaddingTop > 0;
            const showLegacySelectionBar = selectionMode && chatRoomHeader == null;
            if (!needsTopSpacer && !showLegacySelectionBar) return null;
            return (
              <View collapsable={false}>
                {showLegacySelectionBar ? (
                  <View
                    style={[
                      tw`flex-row items-center justify-between px-4 py-2.5 mb-1`,
                      { backgroundColor: V.bgSurface, borderBottomWidth: 0.5, borderBottomColor: V.border },
                    ]}
                  >
                    <TouchableOpacity onPress={exitSelectionMode}>
                      <Text style={[tw`text-[14px]`, { color: V.accentSage }]}>Отмена</Text>
                    </TouchableOpacity>
                    <Text style={[tw`text-[13px] font-medium`, { color: V.textPrimary }]}>
                      {selectedIds.size} выбрано
                    </Text>
                    <TouchableOpacity
                      onPress={batchDeleteForMe}
                      disabled={selectedIds.size === 0}
                      style={{ opacity: selectedIds.size === 0 ? 0.35 : 1 }}
                    >
                      <Trash2 size={20} color={V.dangerMuted} strokeWidth={1.5} />
                    </TouchableOpacity>
                  </View>
                ) : null}
                {needsTopSpacer ? (
                  <View style={{ height: listPaddingTop }} collapsable={false} />
                ) : null}
              </View>
            );
          })()
        }
        contentContainerStyle={[
          tw`pt-1`,
          chatRoomHeader && typeof listPaddingTop === 'number' && listPaddingTop > 0 ? null : tw`pb-2`,
          bottomOverlayH > 0 ? { paddingTop: bottomOverlayH } : inputBarH > 0 ? { paddingTop: inputBarH } : null,
        ]}
        onContentSizeChange={() => {
          pendingLayoutMutationsRef.current += 1;
          layoutStableRef.current = false;
          if (!layoutReadyRef.current) {
            layoutReadyRef.current = true;
          }
          setLayoutSignal((s) => s + 1);
        }}
        ListEmptyComponent={
          <Text style={[tw`text-center py-6 text-[13px]`, { color: V.textMuted }]}>
            Начни общение!
          </Text>
        }
      />

      {chatRoomHeader != null ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            elevation: 50,
          }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) onTopOverlayHeight?.(h);
          }}
        >
          <ChatRoomHeader
            title={chatRoomHeader.title}
            contactOnline={chatRoomHeader.contactOnline}
            navigation={chatRoomHeader.navigation}
            headerRight={chatRoomHeader.headerRight}
            topPaddingOverride={chatRoomHeader.topPaddingOverride}
            selectionMode={selectionMode}
            selectedCount={selectedIds.size}
            onExitSelection={exitSelectionMode}
            onCopy={batchCopySelected}
            onForward={batchForwardSelected}
            onDelete={batchDeleteForMe}
          />
        </View>
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (typeof h === 'number' && h > 0) setBottomOverlayH(h);
        }}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            elevation: 2,
          },
          { transform: [{ translateY: Animated.multiply(keyboardPadding, -1) }] },
        ]}
      >
        {/* Reply preview bar */}
        {replyTo && (
          <View
            style={[
              tw`flex-row items-center px-3 py-2`,
              { backgroundColor: V.bgSurface, borderTopWidth: 0.5, borderTopColor: V.border },
            ]}
          >
            <View style={[tw`flex-1 pl-2`, { borderLeftWidth: 2, borderLeftColor: V.accentSage }]}>
              <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]} numberOfLines={1}>
                {replyTo.player_name}
              </Text>
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={tw`ml-2 p-1`}>
              <X size={16} color={V.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* Emoji picker panel */}
        {showEmojiPicker && (
          <View style={{ borderTopWidth: 0.5, borderTopColor: V.border, backgroundColor: V.bgSurface }}>
            <ScrollView
              style={{ height: 220 }}
              contentContainerStyle={tw`flex-row flex-wrap p-2`}
              keyboardShouldPersistTaps="always"
            >
              {EMOJI_SET.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => insertEmoji(emoji)}
                  style={{ width: '12.5%', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
                >
                  <Text style={tw`text-2xl`}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar — капсула: смайлик | текст / запись | скрепка | микрофон или отправка */}
        <View
          ref={inputBarRef}
          onLayout={(e) => reportInputBar(e.nativeEvent.layout.height)}
          style={{
            paddingHorizontal: TAB_BAR_LAYOUT.horizontalPad,
            paddingTop: TAB_BAR_LAYOUT.topPad,
            paddingBottom: Math.max(
              insets.bottom,
              Math.max(insets.bottom, 10) + TAB_BAR_LAYOUT.floatBottom - 8
            ),
          }}
        >
          <View
            style={{
              borderRadius: TAB_BAR_INNER_ROW_H / 2,
              padding: 0,
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderColor: 'transparent',
              overflow: 'visible',
            }}
          >
          <SafeBlurView
            intensity={Platform.OS === 'ios' ? INPUT_BAR_BLUR_INTENSITY_IOS : INPUT_BAR_BLUR_INTENSITY_ANDROID}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
            style={[
              tw`flex-row items-end`,
              {
                minHeight: TAB_BAR_INNER_ROW_H,
                borderRadius: TAB_BAR_INNER_ROW_H / 2,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
                overflow: 'hidden',
                paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
                paddingRight: 0,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: V.bgElevated,
                  opacity: INPUT_BAR_FROST_TINT_OPACITY,
                },
              ]}
            />
            {/* Inset feel: subtle inner shading (no outer shadow) */}
            <LinearGradient
              pointerEvents="none"
              colors={[V.bgApp, 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 10,
                opacity: 0.12,
              }}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', V.bgApp]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 12,
                opacity: 0.1,
              }}
            />
            {/* Soft "white" (textPrimary) blurred outline */}
            <SafeBlurView
              pointerEvents="none"
              intensity={Platform.OS === 'ios' ? 42 : 28}
              tint="dark"
              blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
              style={[
                {
                  position: 'absolute',
                  top: -3,
                  left: -3,
                  right: -3,
                  bottom: -3,
                  borderRadius: TAB_BAR_INNER_ROW_H / 2,
                  opacity: 0.32,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: TAB_BAR_INNER_ROW_H / 2,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: V.textPrimary,
                  opacity: 0.1,
                },
              ]}
            />
            {/* Emoji / keyboard toggle */}
            <TouchableOpacity
              onPress={toggleEmojiPicker}
              style={{
                width: TAB_BAR_INNER_ROW_H,
                height: TAB_BAR_INNER_ROW_H,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: emojiWobbleRotate.interpolate({
                        inputRange: [-20, 20],
                        outputRange: ['-20deg', '20deg'],
                      }),
                    },
                  ],
                }}
              >
                {showEmojiPicker ? (
                  <KeyboardIcon size={INPUT_BAR_EMOJI_ICON} color={V.textSecondary} strokeWidth={1.5} />
                ) : (
                  <Smile size={INPUT_BAR_EMOJI_ICON} color={V.textSecondary} strokeWidth={1.5} />
                )}
              </Animated.View>
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              ref={inputRef}
              style={[
                tw`flex-1 text-[13px] max-h-24`,
                {
                  color: V.textPrimary,
                  backgroundColor: 'transparent',
                  paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                  paddingHorizontal: 6,
                  minHeight: TAB_BAR_INNER_ROW_H,
                },
              ]}
              placeholder={
                ephemeralSec
                  ? `Сгорит через ${ephemeralSec}с...`
                  : 'Сообщение...'
              }
              placeholderTextColor={V.textGhost}
              value={text}
              onChangeText={setText}
              onSubmitEditing={sendMessage}
              onFocus={() => setShowEmojiPicker(false)}
              returnKeyType="send"
              multiline
            />

            {/* Attach button */}
            <TouchableOpacity
              onPress={() => {
                setShowEmojiPicker(false);
                setShowAttachMenu(true);
              }}
              style={{
                marginLeft: INPUT_BAR_CLIP_MIC_SHIFT + 16,
                width: TAB_BAR_INNER_ROW_H - 2,
                height: TAB_BAR_INNER_ROW_H,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            >
              <Paperclip size={INPUT_BAR_ICON - 2} color={V.textSecondary} strokeWidth={1.5} />
              {ephemeralSec != null && (
                <View
                  style={[
                    tw`absolute top-1 right-0.5 w-2 h-2 rounded-full`,
                    { backgroundColor: V.accentGold },
                  ]}
                />
              )}
            </TouchableOpacity>

            {/* Send button (when text) or spacer (for mic layout) */}
            {text.trim() && !isRecordingVoice ? (
              <TouchableOpacity
                onPress={sendMessage}
                style={{
                  marginLeft: INPUT_BAR_CLIP_MIC_SHIFT,
                  width: TAB_BAR_INNER_ROW_H,
                  height: TAB_BAR_INNER_ROW_H,
                  borderRadius: TAB_BAR_INNER_ROW_H / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: V.btnPrimaryBg,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: V.accentSage,
                }}
              >
                <Send size={INPUT_BAR_ICON - 2} color={V.accentSage} strokeWidth={1.5} />
              </TouchableOpacity>
            ) : (
              /* Spacer: reserves the same width so text input doesn't reflow */
              <View style={{ width: INPUT_BAR_CLIP_MIC_SHIFT + MIC_BUTTON_SIZE }} />
            )}
          </SafeBlurView>

          {/* VoiceRecorder: absolute overlay on depth-ring; renders mic in IDLE, full UI when active */}
          {(!text.trim() || isRecordingVoice) && (
            <VoiceRecorder
              onSendAudio={handleSendVoice}
              onRecordingChange={setIsRecordingVoice}
              uploadMedia={uploadMedia}
              sendMediaMessage={sendMediaMessage}
              onOpen={() => setActiveVideoId(null)}
            />
          )}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
