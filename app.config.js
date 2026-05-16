const appJson = require('./app.json');
const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Добавляет в AndroidManifest поддержку планшетов:
 * - resizeableActivity=true (убирает letterbox на широком экране)
 * - supports-screens с largeScreens / xlargeScreens
 */
function withTabletSupport(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // supports-screens
    manifest['supports-screens'] = [
      {
        $: {
          'android:smallScreens': 'true',
          'android:normalScreens': 'true',
          'android:largeScreens': 'true',
          'android:xlargeScreens': 'true',
          'android:resizeable': 'true',
          'android:anyDensity': 'true',
        },
      },
    ];

    // resizeableActivity на MainActivity
    const app = manifest.application?.[0];
    if (app?.activity) {
      const main = app.activity.find(
        (a) => a.$?.['android:name'] === '.MainActivity'
      );
      if (main) {
        main.$['android:resizeableActivity'] = 'true';
      }
    }

    return cfg;
  });
}

/**
 * EAS задаёт APP_VARIANT в eas.json (development | production).
 * Dev-сборка получает отдельный package / bundleId — рядом со сторовой установкой.
 */
module.exports = function appConfig() {
  const isDev = process.env.APP_VARIANT === 'development';
  const base = appJson.expo;
  const android = { ...base.android };
  const ios = { ...base.ios };

  if (isDev) {
    // google-services.json привязан к com.vault.messenger; для .dev Gradle падает
    // (нет client с таким package). Dev без FCM — файл не подключаем.
    const androidForDev = { ...android, package: 'com.vault.messenger.dev' };
    delete androidForDev.googleServicesFile;

    return withTabletSupport({
      expo: {
        ...base,
        name: 'Vault (разработка)',
        android: androidForDev,
        ios: {
          ...ios,
          bundleIdentifier: 'com.vault.messenger.dev',
        },
      },
    });
  }

  return withTabletSupport({
    expo: {
      ...base,
      ios: {
        ...ios,
        bundleIdentifier: ios.bundleIdentifier ?? 'com.vault.messenger',
      },
    },
  });
};
