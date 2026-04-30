/**
 * Код приглашения: 10–14 символов, [a-z2-9] без похожих (без i, l, o, 0, 1).
 * Энтропия: charset 32 символа, длина 10–14 → ~50–70 бит.
 */
const INVITE_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';
const LEN_MIN = 10;
const LEN_MAX = 14;

function randomUint8(n) {
  const buf = new globalThis.Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

export function generateInviteCode() {
  const len = LEN_MIN + (randomUint8(1)[0] % (LEN_MAX - LEN_MIN + 1));
  const bytes = randomUint8(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += INVITE_CHARSET[bytes[i] % INVITE_CHARSET.length];
  }
  return out;
}
