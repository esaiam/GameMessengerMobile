/**
 * Удаляет все объекты из bucket chat-media (orphans после DELETE FROM messages).
 *
 * Требует service_role (НЕ в клиенте, НЕ коммитить):
 *   SUPABASE_SERVICE_ROLE_KEY в .env.local или разово в терминале
 *
 * Usage:
 *   node scripts/cleanup-orphan-chat-media.mjs
 *   node scripts/cleanup-orphan-chat-media.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const BUCKET = 'chat-media';
const BATCH = 100;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(root, '.env.smoke')),
  ...loadEnvFile(path.join(root, '.env.local')),
};

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '[cleanup-storage] Need EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY\n' +
      '  Dashboard → Settings → API → service_role (только локально, .env.local)'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Рекурсивный list — Supabase возвращает «папки» без metadata. */
async function collectPaths(prefix = '') {
  const paths = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // Папка: id null или mimetype отсутствует у «folder placeholder»
      const isFolder = item.id == null;
      if (isFolder) {
        paths.push(...(await collectPaths(full)));
      } else {
        paths.push(full);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return paths;
}

console.log(`[cleanup-storage] bucket=${BUCKET} dryRun=${dryRun}`);

const allPaths = await collectPaths();
console.log(`  found ${allPaths.length} object(s)`);

if (allPaths.length === 0) {
  console.log('[cleanup-storage] nothing to delete');
  process.exit(0);
}

if (dryRun) {
  allPaths.slice(0, 10).forEach((p) => console.log(`  would delete: ${p}`));
  if (allPaths.length > 10) console.log(`  … and ${allPaths.length - 10} more`);
  process.exit(0);
}

let deleted = 0;
for (let i = 0; i < allPaths.length; i += BATCH) {
  const batch = allPaths.slice(i, i + BATCH);
  const { data, error } = await admin.storage.from(BUCKET).remove(batch);
  if (error) {
    console.error('[cleanup-storage] remove failed:', error.message);
    process.exit(1);
  }
  deleted += (data || batch).length;
  console.log(`  deleted ${deleted}/${allPaths.length}`);
}

console.log('[cleanup-storage] OK');
