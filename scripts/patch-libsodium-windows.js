/**
 * react-native-libsodium передаёт NODE_MODULES_DIR с обратными слэшами —
 * CMake на Windows падает с "Invalid character escape '\P'".
 */
const fs = require('fs');
const path = require('path');

const buildGradle = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-libsodium',
  'android',
  'build.gradle'
);

if (!fs.existsSync(buildGradle)) {
  process.exit(0);
}

let src = fs.readFileSync(buildGradle, 'utf8');
const needle = '"-DNODE_MODULES_DIR=${nodeModules}"';
const replacement = '"-DNODE_MODULES_DIR=${nodeModules.replace(\'\\\\\', \'/\')}"';

if (src.includes(replacement)) {
  process.exit(0);
}

if (!src.includes(needle)) {
  console.warn('[patch-libsodium-windows] unexpected build.gradle, skip');
  process.exit(0);
}

src = src.replace(needle, replacement);
fs.writeFileSync(buildGradle, src);
console.log('[patch-libsodium-windows] NODE_MODULES_DIR uses forward slashes');
