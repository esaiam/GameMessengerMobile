/**
 * Напоминание: crypto smoke только на устройстве (__DEV__), не в Node.
 */
console.log(`
[smoke:crypto] vaultCryptoSmokeTests — только в dev-клиенте (react-native-libsodium).

  1. npx expo start
  2. В консоли Metro / debugger:
     await global.runVaultCryptoTests();

Подробнее: docs/TESTING.md
`);
