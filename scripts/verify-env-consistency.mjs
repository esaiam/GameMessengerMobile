/**
 * Сверяет EXPO_PUBLIC_SUPABASE_URL в .env и в eas.json (development + production).
 * Запуск: node scripts/verify-env-consistency.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readEasUrls() {
  const raw = fs.readFileSync(path.join(root, 'eas.json'), 'utf8');
  const j = JSON.parse(raw);
  const dev = j?.build?.development?.env?.EXPO_PUBLIC_SUPABASE_URL || null;
  const prod = j?.build?.production?.env?.EXPO_PUBLIC_SUPABASE_URL || null;
  return { dev, prod };
}

function readDotEnvUrl() {
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return { path: p, url: null, exists: false };
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/^\s*EXPO_PUBLIC_SUPABASE_URL\s*=\s*(\S+)/m);
  const url = m ? m[1].trim() : null;
  return { path: p, url, exists: true };
}

function norm(u) {
  return typeof u === 'string' ? u.replace(/\/+$/, '') : '';
}

const { dev: easDev, prod: easProd } = readEasUrls();
const dot = readDotEnvUrl();

console.log('[Vault verify] eas.json development EXPO_PUBLIC_SUPABASE_URL:', easDev || '(нет)');
console.log('[Vault verify] eas.json production  EXPO_PUBLIC_SUPABASE_URL:', easProd || '(нет)');
console.log(
  '[Vault verify] .env EXPO_PUBLIC_SUPABASE_URL:',
  dot.exists ? dot.url || '(ключ не найден)' : '(нет файла ' + dot.path + ')'
);

const issues = [];
if (norm(easDev) !== norm(easProd)) {
  issues.push('development и production в eas.json указывают на разные Supabase URL.');
}
if (dot.exists && dot.url && norm(dot.url) !== norm(easDev)) {
  issues.push(
    'Локальный .env ≠ eas.json development. При expo start (Metro) бандл возьмёт URL из .env; ' +
      'чистый APK с EAS — из eas.json. Два телефона могут оказаться в разных инстансах/прокси.'
  );
}

if (issues.length === 0) {
  console.log('[Vault verify] OK: URL согласованы (или .env нет — только EAS).');
} else {
  console.log('[Vault verify] ВНИМАНИЕ:');
  issues.forEach((t) => console.log('  -', t));
  process.exitCode = 1;
}
