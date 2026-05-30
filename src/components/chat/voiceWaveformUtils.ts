export function fmtDur(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/** Амплитуды 0…1 → 40 высот столбиков (4…40) для сохранения в сообщении. */
export function buildWaveform40FromAmps(
  amps: number[],
  trimStart: number,
  trimEnd: number,
): number[] {
  const TARGET = 40;
  if (!amps.length) return Array(TARGET).fill(4);
  const i0 = Math.min(amps.length - 1, Math.max(0, Math.floor(trimStart * amps.length)));
  const i1 = Math.min(amps.length, Math.max(i0 + 1, Math.ceil(trimEnd * amps.length)));
  const slice = amps.slice(i0, i1);
  const n = slice.length;
  const out: number[] = [];
  for (let i = 0; i < TARGET; i++) {
    const t0 = (i / TARGET) * n;
    const t1 = ((i + 1) / TARGET) * n;
    let mx = 0.008;
    const j0 = Math.floor(t0);
    const j1 = Math.ceil(t1);
    for (let j = j0; j < j1 && j < n; j++) {
      mx = Math.max(mx, slice[j] ?? 0);
    }
    // Растягиваем тихие уровни (иначе всё упирается в min 4px после clamp).
    const shaped = Math.pow(Math.min(1, Math.max(0, mx)), 0.58);
    out.push(Math.max(5, Math.min(39, 5 + shaped * 34)));
  }
  return out;
}
