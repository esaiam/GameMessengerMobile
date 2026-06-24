-- Expo push token for Vault client + Aria server (service_role read).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text;

COMMENT ON COLUMN public.profiles.push_token IS
  'ExponentPushToken[...] from expo-notifications; client writes own row, server reads via service_role';
