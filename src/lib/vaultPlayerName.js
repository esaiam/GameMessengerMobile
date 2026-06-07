/** Единый формат @handle для E2E (без @, lowercase). */
export function normalizeVaultPlayerName(name) {
  const raw = typeof name === 'string' ? name.trim().replace(/^@+/, '').toLowerCase() : '';
  return raw || null;
}
