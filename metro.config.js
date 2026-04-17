const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Иконки импортируются из src/icons/lucideIcons.js (прямые пути в dist/cjs/icons).
// Подмена всего пакета на один CJS-бандл ломала именованные экспорты в Hermes.

module.exports = config;
