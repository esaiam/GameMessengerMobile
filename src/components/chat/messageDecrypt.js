import { decryptVm2MessageText, isVm2Payload } from '../../lib/vm2MessageText';
import {
  loadDecryptTextDisk,
  saveDecryptTextDisk,
  clearDecryptTextDisk,
} from '../../utils/decryptedTextDiskCache';

const CACHE_CAP = 500;
const PERSIST_DEBOUNCE_MS = 400;

/** id → { plain, cipher } — in-memory + debounced disk */
const decryptedCache = new Map();

let diskNickname = null;
let diskLoadPromise = null;
let persistTimer = null;
let pendingPersistNickname = null;

/** Лёгкий отпечаток VM2 ciphertext для invalidation при UPDATE. */
export function makeCipherKey(raw) {
  if (!raw || typeof raw !== 'string') return '';
  if (!isVm2Payload(raw)) return raw;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }
  return `${raw.length}:${hash}`;
}

function getCachedPlain(messageId, cipherRaw) {
  const entry = decryptedCache.get(messageId);
  if (!entry) return null;
  const cipherKey = makeCipherKey(cipherRaw);
  if (entry.cipher !== cipherKey) {
    decryptedCache.delete(messageId);
    return null;
  }
  return entry.plain;
}

function setCachedPlain(messageId, cipherRaw, plain, nickname) {
  if (!messageId || !plain || isVm2Payload(plain)) return;
  const cipherKey = makeCipherKey(cipherRaw);
  if (decryptedCache.has(messageId)) decryptedCache.delete(messageId);
  decryptedCache.set(messageId, { plain, cipher: cipherKey });
  while (decryptedCache.size > CACHE_CAP) {
    const oldest = decryptedCache.keys().next().value;
    decryptedCache.delete(oldest);
  }
  if (nickname) schedulePersist(nickname);
}

function schedulePersist(nickname) {
  pendingPersistNickname = nickname;
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const nick = pendingPersistNickname;
    pendingPersistNickname = null;
    if (!nick) return;
    const obj = {};
    for (const [id, entry] of decryptedCache) {
      obj[id] = { p: entry.plain, c: entry.cipher };
    }
    void saveDecryptTextDisk(nick, obj);
  }, PERSIST_DEBOUNCE_MS);
}

async function ensureDiskLoaded(nickname) {
  if (!nickname) return;
  if (diskNickname === nickname && diskLoadPromise === null) return;
  if (diskNickname !== nickname) {
    decryptedCache.clear();
    diskNickname = nickname;
    diskLoadPromise = null;
  }
  if (!diskLoadPromise) {
    diskLoadPromise = (async () => {
      const disk = await loadDecryptTextDisk(nickname);
      if (disk) {
        for (const [id, entry] of Object.entries(disk)) {
          if (entry?.p && entry?.c) {
            decryptedCache.set(id, { plain: entry.p, cipher: entry.c });
          }
        }
      }
    })();
  }
  await diskLoadPromise;
}

/** Сбросить кэш одного сообщения (UPDATE text / DELETE). */
export function invalidateDecryptCache(messageId) {
  if (messageId == null) return;
  if (!decryptedCache.delete(messageId)) return;
  if (diskNickname) schedulePersist(diskNickname);
}

/** После успешного edit — сохранить plaintext под новым ciphertext. */
export function primeDecryptPlainCache(messageId, cipherRaw, plain, nickname) {
  setCachedPlain(messageId, cipherRaw, plain, nickname);
}

/** Logout / смена пользователя. */
export async function clearDecryptCache(nickname) {
  decryptedCache.clear();
  diskNickname = null;
  diskLoadPromise = null;
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  pendingPersistNickname = null;
  await clearDecryptTextDisk(nickname);
}

/**
 * @param {{ nickname: string }} ctx
 * @returns {(msg: import('./chatMessageTypes').ChatMessageRow) => Promise<import('./chatMessageTypes').ChatMessageRow>}
 */
export function createDecryptMsg({ nickname }) {
  return async function decryptMsg(msg) {
    await ensureDiskLoaded(nickname);
    const raw = msg.text;
    if (!raw) return msg;

    if (isVm2Payload(raw)) {
      const cached = getCachedPlain(msg.id, raw);
      if (cached !== null) return { ...msg, text: cached };
      const plain = await decryptVm2MessageText(raw, msg, nickname);
      if (plain !== null) {
        setCachedPlain(msg.id, raw, plain, nickname);
        return { ...msg, text: plain };
      }
      return { ...msg, text: '🔒 Сообщение зашифровано' };
    }

    return msg;
  };
}

/**
 * @param {import('./chatMessageTypes').ChatMessageRow[]} msgs
 * @param {(msg: import('./chatMessageTypes').ChatMessageRow) => Promise<import('./chatMessageTypes').ChatMessageRow>} decryptMsg
 * @param {string | undefined} nickname
 */
export async function decryptMessagesBatch(msgs, decryptMsg, nickname) {
  if (nickname) await ensureDiskLoaded(nickname);
  const CHUNK = 10;
  const result = [];
  for (let i = 0; i < msgs.length; i += CHUNK) {
    const chunk = msgs.slice(i, i + CHUNK);
    const decrypted = await Promise.all(
      chunk.map(async (m) => {
        const raw = m.text;
        if (raw && isVm2Payload(raw)) {
          const cached = getCachedPlain(m.id, raw);
          if (cached !== null) return { ...m, text: cached };
        }
        const row = await decryptMsg(m);
        if (row.text !== m.text && !isVm2Payload(row.text) && isVm2Payload(m.text)) {
          setCachedPlain(m.id, m.text, row.text, nickname);
        }
        return row;
      }),
    );
    result.push(...decrypted);
  }
  return result;
}
