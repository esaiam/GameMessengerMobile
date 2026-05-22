import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { runAuthStorageMigration } from './src/lib/authStorageMigration';
import { runNicknameStorageMigration } from './src/lib/nicknameStorage';

/** Токены Vault (без импорта theme — меньше шансов на цикл/ранний резолв при бандле). */
const SPLASH_BG = '#0D0F14';
const SPLASH_FG = '#E8E4DA';

/**
 * Даёт AsyncStorage-миграции завершиться до import('./App') (singleton supabase).
 */
export default function RootBootstrap() {
  const [AppComponent, setAppComponent] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await runAuthStorageMigration();
        await runNicknameStorageMigration();
        if (!alive) return;
        const { default: App } = await import('./App');
        if (alive) setAppComponent(() => App);
      } catch (e) {
        console.error('[Vault] RootBootstrap:', e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!AppComponent) {
    return (
      <View style={styles.splash}>
        <Text style={styles.text}>Загрузка...</Text>
      </View>
    );
  }

  return <AppComponent />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center' },
  text: { color: SPLASH_FG, fontSize: 13, fontWeight: '400'  } });
