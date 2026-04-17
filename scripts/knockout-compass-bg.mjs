/**
 * Убирает светлый фон у compass-star.png (заливка от краёв — только «внешняя» подложка).
 * Запуск: node scripts/knockout-compass-bg.mjs
 */
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Jimp } from 'jimp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'assets', 'compass-star.png');

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

/** Пиксели похожие на белый/светло-серый фон (не тёмные лучи звезды). */
function isBgLike(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  return max >= 230 && spread <= 40;
}

async function main() {
  const img = await Jimp.read(inputPath);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const visited = new Uint8Array(w * h);
  const q = [];

  const idx = (x, y) => y * w + x;
  const pushEdge = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = idx(x, y);
    if (visited[i]) return;
    const { r, g, b } = rgbaFromInt(img.getPixelColor(x, y));
    if (!isBgLike(r, g, b)) return;
    visited[i] = 1;
    q.push([x, y]);
  };

  for (let x = 0; x < w; x++) {
    pushEdge(x, 0);
    pushEdge(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushEdge(0, y);
    pushEdge(w - 1, y);
  }

  while (q.length) {
    const [x, y] = q.pop();
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const i = idx(nx, ny);
      if (visited[i]) continue;
      const { r, g, b } = rgbaFromInt(img.getPixelColor(nx, ny));
      if (!isBgLike(r, g, b)) continue;
      visited[i] = 1;
      q.push([nx, ny]);
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (visited[idx(x, y)]) {
        img.setPixelColor(toInt(0, 0, 0, 0), x, y);
      }
    }
  }

  const buf = await img.getBuffer('image/png');
  await writeFile(inputPath, buf);
  console.log('OK: фон с краёв снят → прозрачность,', w, 'x', h);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
