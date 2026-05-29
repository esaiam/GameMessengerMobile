/**
 * expo-video-audio-extractor@0.1.0 — promise.reject(Throwable) не компилируется на Expo SDK 54.
 * Нужна сигнатура reject(code, message?, cause?).
 */
const fs = require('fs');
const path = require('path');

const ktPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-video-audio-extractor',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'videoaudioextractor',
  'ExpoVideoAudioExtractorModule.kt',
);

if (!fs.existsSync(ktPath)) {
  process.exit(0);
}

const oldLine = '          promise.reject("EXTRACT_ERROR", t)';
const newLine =
  '          promise.reject("EXTRACT_ERROR", t.message ?: "Extract failed", t)';

let src = fs.readFileSync(ktPath, 'utf8');
if (src.includes(newLine)) {
  process.exit(0);
}
if (!src.includes(oldLine)) {
  console.warn('[patch-video-audio-extractor-sdk54] unexpected Kotlin, skip');
  process.exit(0);
}

src = src.replace(oldLine, newLine);
fs.writeFileSync(ktPath, src);
console.log('[patch-video-audio-extractor-sdk54] fixed promise.reject for SDK 54');
