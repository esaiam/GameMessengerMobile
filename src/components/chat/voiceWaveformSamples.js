/**
 * Pure voice waveform normalization for display (40 bars) and DB fallback payload.
 */

export const VOICE_WAVE_DIM = 'rgba(90,158,154,0.3)';
export const VOICE_WAVE_BAR_TARGET = 40;
export const VOICE_WAVE_GAP = 2;

/** Fallback, если метринг не дал сэмплов — всё равно пишем в БД непустой jsonb. */
export const DEFAULT_VOICE_WAVEFORM = () =>
  Array.from({ length: VOICE_WAVE_BAR_TARGET }, () => 10);

export function coerceWaveformToNumberArray(raw) {
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

export function parseStoredVoiceWaveform(raw) {
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
