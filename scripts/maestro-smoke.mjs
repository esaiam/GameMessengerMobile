/**
 * Maestro E2E baseline — обёртка над CLI.
 *
 * Требования:
 *   - Maestro CLI: https://maestro.mobile.dev/docs/getting-started/installing-maestro
 *   - Android-эмулятор или устройство с dev client / APK
 *   - Приложение уже установлено (package = MAESTRO_APP_ID)
 *   - `.env.smoke`: SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD, SMOKE_TEST_PEER_HANDLE
 *
 * Запуск:
 *   npm run maestro:smoke
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

function loadEnv() {
  return {
    ...loadEnvFile(path.join(root, '.env')),
    ...loadEnvFile(path.join(root, '.env.smoke')),
  };
}

function fail(msg) {
  console.error(`[maestro:smoke] ${msg}`);
  process.exit(1);
}

const env = loadEnv();
const email = env.SMOKE_TEST_EMAIL;
const password = env.SMOKE_TEST_PASSWORD;
const peerHandle = env.SMOKE_TEST_PEER_HANDLE;

if (!email || !password) {
  fail('Need SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD in .env.smoke (see .env.smoke.example)');
}
if (!peerHandle) {
  fail('Need SMOKE_TEST_PEER_HANDLE in .env.smoke — display name контакта в списке чатов');
}

const maestroBin = process.platform === 'win32' ? 'maestro.cmd' : 'maestro';
const versionCheck = spawnSync(maestroBin, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (versionCheck.error || versionCheck.status !== 0) {
  fail(
    'Maestro CLI not found. Install: https://maestro.mobile.dev/docs/getting-started/installing-maestro\n' +
      'Windows: download from GitHub releases or use WSL.'
  );
}

const appId = env.MAESTRO_APP_ID || 'com.vault.messenger';
const messageText = env.MAESTRO_MESSAGE_TEXT || `maestro-smoke-${Date.now()}`;
const flowPath = path.join(root, '.maestro', 'smoke.yaml');

if (!fs.existsSync(flowPath)) {
  fail(`Flow not found: ${flowPath}`);
}

console.log('[maestro:smoke] Vault Messenger E2E baseline');
console.log(`  appId: ${appId}`);
console.log(`  peer:  ${peerHandle}`);
console.log(`  text:  ${messageText}`);
console.log(`  flow:  .maestro/smoke.yaml`);
console.log('');

const args = [
  'test',
  flowPath,
  '-e',
  `MAESTRO_APP_ID=${appId}`,
  '-e',
  `SMOKE_TEST_EMAIL=${email}`,
  '-e',
  `SMOKE_TEST_PASSWORD=${password}`,
  '-e',
  `SMOKE_TEST_PEER_HANDLE=${peerHandle}`,
  '-e',
  `MAESTRO_MESSAGE_TEXT=${messageText}`,
];

const result = spawnSync(maestroBin, args, {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
