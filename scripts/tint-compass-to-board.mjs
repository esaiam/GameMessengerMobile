/**
 * Светлые участки розы ветров → цвет фона доски #1A1D24 (boardPalette.bg).
 * Тёмные линии не трогаем. Запуск: node scripts/tint-compass-to-board.mjs
 */
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Jimp } from 'jimp';

const BR = 26;
const BG = 29;
const BB = 36;

const __dirname = dirname(fileURLToPath(import.meta.url));
const pngPath = join(__dirname, '..', 'assets', 'compass-star.png');

function rgbaFromInt(c) {
  return {
    r: (c >> 24) & 0xff,
    g: (c >> 16) & 0xff,
    b: (c >> 8) & 0xff,
    a: c & 0xff,
  };
}

function toInt(r, g, b, a) {
  return (r << 24) | (g << 16) | (b << 8) | a;
}

/**
 * Светлые и средние (в т.ч. старая коричневая подложка ~#523A31, lum ~63) → в тон доски.
 * Не трогаем только очень тёмные штрихи/антialiasing (lum < 30), иначе коричневое
 * оставалось бы нетронутым из‑за порога lum < 88.
 */
function recolor(r, g, b, a) {
  if (a < 4) return { r: 0, g: 0, b: 0, a: 0 };
  const lum = (r + g + b) / 3;
  if (lum < 30) return { r, g, b, a };
  if (lum > 220) return { r: BR, g: BG, b: BB, a };
  const t = Math.min(1, (lum - 30) / (78 - 30));
  return {
    r: Math.round(r * (1 - t) + BR * t),
    g: Math.round(g * (1 - t) + BG * t),
    b: Math.round(b * (1 - t) + BB * t),
    a,
  };
}

async function main() {
  const img = await Jimp.read(pngPath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rgbaFromInt(img.getPixelColor(x, y));
      const o = recolor(c.r, c.g, c.b, c.a);
      img.setPixelColor(toInt(o.r, o.g, o.b, o.a), x, y);
    }
  }
  const buf = await img.getBuffer('image/png');
  await writeFile(pngPath, buf);
  console.log('OK: светлые элементы звезды перекрашены в #1A1D24,', w, 'x', h);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
