import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { parseAuthRecoveryFromUrl } from '../utils/authRecoveryDeepLink';
import {
  VAULT_PENDING_INVITE_KEY,
  callRedeemInviteCode,
  inviteRedeemErrorMessage,
  inviteRedeemErrorTitle,
  parsePendingInvite } from '../utils/inviteRedeem';
import {
  NICKNAME_STORAGE_KEY,
  readNicknameFromStorage,
  writeNicknameToStorage,
} from '../lib/nicknameStorage';

export { NICKNAME_STORAGE_KEY };
const SESSION_CACHE_KEY = '@vault_session_cache';

const AuthGateContext = createContext(null);

async function fetchProfileHandle(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('handle')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    if (__DEV__) console.warn('[AuthGate] profiles select', error.message);
    return null;
  }
  return data?.handle ?? null;
}

async function readCachedSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Не используем просроченную сессию (expires_at в секундах unix)
    if (parsed?.expires_at && parsed.expires_at * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedSession(session) {
  try {
    if (session) {
      await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(SESSION_CACHE_KEY);
    }
  } catch {}
}

async function readCachedHandle() {
  try {
    return await readNicknameFromStorage();
  } catch {
    return null;
  }
}

/**
 * Pending invite + redeem (только при наличии сессии):
 * - После signUp без сессии код лежит в AsyncStorage; при появлении сессии — один redeem, затем removeItem.
 * - После signUp со сессией код уже записан до signUp; здесь же redeem и removeItem.
 * - При любой финальной ошибке redeem (включая transport) — removeItem + signOut, чтобы не зацикливать cold start.
 * - exhausted / not_found / expired — не повторяем; ключ всегда снимаем после попытки с ответом RPC.
 */
async function redeemPendingInviteOrClear(sessionUser) {
  const raw = await AsyncStorage.getItem(VAULT_PENDING_INVITE_KEY);
  if (!raw) return { hadPending: false };

  const parsed = parsePendingInvite(raw);
  const sessionEmail = String(sessionUser?.email || '').trim().toLowerCase();
  if (!parsed || parsed.email !== sessionEmail) {
    await AsyncStorage.removeItem(VAULT_PENDING_INVITE_KEY);
    return { hadPending: true, failed: false, skipped: true };
  }

  const { ok, errorReason, transportError } = await callRedeemInviteCode(parsed.code);
  await AsyncStorage.removeItem(VAULT_PENDING_INVITE_KEY);

  if (transportError) {
    Alert.alert(
      inviteRedeemErrorTitle(),
      'Не удалось связаться с сервером. Войдите снова после проверки сети.'
    );
    await supabase.auth.signOut();
    return { hadPending: true, failed: true };
  }

  if (!ok) {
    Alert.alert(inviteRedeemErrorTitle(), inviteRedeemErrorMessage(errorReason));
    await supabase.auth.signOut();
    return { hadPending: true, failed: true };
  }

  return { hadPending: true, failed: false };
}

export function AuthGateProvider({ children }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState(null);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const [inviteCheckDone, setInviteCheckDone] = useState(false);
  const [profileStatus, setProfileStatus] = useState('idle');
  const [profileHandle, setProfileHandle] = useState(null);

  const loadProfile = useCallback(async (userId, opts = {}) => {
    const quiet = Boolean(opts.quiet);
    if (!userId) return;
    if (!quiet) setProfileStatus('loading');
    const handle = await fetchProfileHandle(userId);
    setProfileHandle(handle);
    if (handle) {
      await writeNicknameToStorage(handle);
    }
    setProfileStatus('ready');
  }, []);

  const clearPasswordRecoveryFlow = useCallback(() => {
    setPasswordRecoveryPending(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyRecoveryUrl = async (url) => {
      const parsed = parseAuthRecoveryFromUrl(url);
      if (!parsed) return;
      const { error } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token });
      if (error && mounted) {
        Alert.alert('Сброс пароля', error.message);
        return;
      }
      if (parsed.type === 'recovery' && mounted) {
        setPasswordRecoveryPending(true);
      }
    };

    const {
      data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Сохраняем актуальную сессию в кэш при каждом изменении
      writeCachedSession(nextSession ?? null);
      setSession(nextSession ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryPending(true);
      }
      if (!nextSession) {
        AsyncStorage.removeItem(VAULT_PENDING_INVITE_KEY).catch(() => {});
        setInviteCheckDone(true);
        setProfileStatus('idle');
        setProfileHandle(null);
        setPasswordRecoveryPending(false);
      }
    });

    const linkSub = Linking.addEventListener('url', (e) => {
      if (e?.url) applyRecoveryUrl(e.url);
    });

    (async () => {
      try {
        // Шаг 1: читаем кэш из AsyncStorage — мгновенно, без сети
        const [cachedSession, cachedHandle] = await Promise.all([
          readCachedSession(),
          readCachedHandle()]);
        if (!mounted) return;

        if (cachedSession) {
          setSession(cachedSession);
          if (cachedHandle) {
            setProfileHandle(cachedHandle);
            setProfileStatus('ready');
          }
        }
        // Показываем UI сразу — даже если сессия из кэша
        setBootstrapped(true);

        // Шаг 2: проверяем сессию у Supabase в фоне (обновляет токен если надо)
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const liveSession = data.session ?? null;
        writeCachedSession(liveSession);
        setSession(liveSession);

        const url = await Linking.getInitialURL();
        if (mounted && url) await applyRecoveryUrl(url);
      } catch {
        if (mounted) setBootstrapped(true);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;

    if (!session?.user?.id) {
      setInviteCheckDone(true);
      return;
    }

    let cancelled = false;
    setInviteCheckDone(false);

    (async () => {
      try {
        const pending = await AsyncStorage.getItem(VAULT_PENDING_INVITE_KEY);
        if (!pending) {
          if (!cancelled) setInviteCheckDone(true);
          return;
        }
        await redeemPendingInviteOrClear(session.user);
      } finally {
        if (!cancelled) setInviteCheckDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, session?.user?.id]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !inviteCheckDone) {
      if (!uid) {
        setProfileStatus('idle');
        setProfileHandle(null);
      }
      return;
    }
    // quiet=true если handle уже есть из кэша — не показываем loading, просто обновляем в фоне
    loadProfile(uid, { quiet: Boolean(profileHandle) });
  }, [session?.user?.id, inviteCheckDone, loadProfile]);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    await loadProfile(uid, { quiet: true });
  }, [loadProfile, session?.user?.id]);

  const value = useMemo(
    () => ({
      bootstrapped,
      session,
      passwordRecoveryPending,
      clearPasswordRecoveryFlow,
      inviteCheckDone,
      profileStatus,
      profileHandle,
      refreshProfile }),
    [
      bootstrapped,
      session,
      passwordRecoveryPending,
      clearPasswordRecoveryFlow,
      inviteCheckDone,
      profileStatus,
      profileHandle,
      refreshProfile]
  );

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error('useAuthGate must be used within AuthGateProvider');
  }
  return ctx;
}
