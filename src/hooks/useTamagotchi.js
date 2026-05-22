import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import {
  AriaRateLimitError,
  DEFAULT_ARIA_STATE,
  fetchAriaState,
  fetchPendingMessages,
  postAriaAction } from '../lib/tamagotchi/tamagotchiApi';

const POLL_MS = 5000;
const ACTION_COOLDOWN_MS = 3000;
const INNER_THOUGHT_MS = 3000;
const PENDING_STEP_MS = 600;

export function useTamagotchi() {
  const [state, setState] = useState(DEFAULT_ARIA_STATE);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [innerThought, setInnerThought] = useState('');
  const [pendingBubble, setPendingBubble] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [cooldownHint, setCooldownHint] = useState('');
  const [actionCooldown, setActionCooldown] = useState(false);

  const focusedRef = useRef(false);
  const pollTimerRef = useRef(null);
  const thoughtTimerRef = useRef(null);
  const actionCooldownTimerRef = useRef(null);
  const cooldownTickRef = useRef(null);

  const clearThoughtTimer = useCallback(() => {
    if (thoughtTimerRef.current) {
      clearTimeout(thoughtTimerRef.current);
      thoughtTimerRef.current = null;
    }
  }, []);

  const showInnerThought = useCallback(
    (text) => {
      clearThoughtTimer();
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) {
        setInnerThought('');
        return;
      }
      setInnerThought(trimmed);
      thoughtTimerRef.current = setTimeout(() => {
        setInnerThought('');
        thoughtTimerRef.current = null;
      }, INNER_THOUGHT_MS);
    },
    [clearThoughtTimer]
  );

  const showPendingSequence = useCallback((texts) => {
    if (!Array.isArray(texts) || texts.length === 0) return;
    let i = 0;
    const showNext = () => {
      if (!focusedRef.current) return;
      setPendingBubble(texts[i]);
      i += 1;
      if (i < texts.length) {
        setTimeout(showNext, PENDING_STEP_MS);
      } else {
        setTimeout(() => setPendingBubble(''), PENDING_STEP_MS);
      }
    };
    showNext();
  }, []);

  const resolveUserId = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user?.id ?? null;
    } catch {
      return null;
    }
  }, []);

  const refreshState = useCallback(async (uid) => {
    const id = uid ?? userId;
    if (!id) return;
    const next = await fetchAriaState(id);
    if (next) setState(next);
  }, [userId]);

  const pollTick = useCallback(async () => {
    const uid = userId ?? (await resolveUserId());
    if (!uid) return;
    await refreshState(uid);
  }, [userId, resolveUserId, refreshState]);

  const loadPending = useCallback(async (uid) => {
    const id = uid ?? userId;
    if (!id) return;
    const texts = await fetchPendingMessages(id);
    if (texts.length) showPendingSequence(texts);
  }, [userId, showPendingSequence]);

  const startActionCooldown = useCallback((ms = ACTION_COOLDOWN_MS) => {
    if (actionCooldownTimerRef.current) clearTimeout(actionCooldownTimerRef.current);
    setActionCooldown(true);
    actionCooldownTimerRef.current = setTimeout(() => {
      setActionCooldown(false);
      actionCooldownTimerRef.current = null;
    }, ms);
  }, []);

  const startRateLimitHint = useCallback((seconds) => {
    const sec = Math.max(1, Math.ceil(Number(seconds) || 3));
    setCooldownHint(`Подожди ${sec} с`);
    startActionCooldown(sec * 1000);

    if (cooldownTickRef.current) clearInterval(cooldownTickRef.current);
    const until = Date.now() + sec * 1000;
    cooldownTickRef.current = setInterval(() => {
      const leftMs = until - Date.now();
      if (leftMs <= 0) {
        setCooldownHint('');
        if (cooldownTickRef.current) {
          clearInterval(cooldownTickRef.current);
          cooldownTickRef.current = null;
        }
        return;
      }
      setCooldownHint(`Подожди ${Math.ceil(leftMs / 1000)} с`);
    }, 250);
  }, [startActionCooldown]);

  const performAction = useCallback(
    async (action) => {
      if (actionBusy || actionCooldown) return;
      const uid = userId ?? (await resolveUserId());
      if (!uid) return;

      setActionBusy(true);
      try {
        const { state: nextState, inner_thought } = await postAriaAction(uid, action);
        setState(nextState);
        showInnerThought(inner_thought);
        startActionCooldown();
      } catch (e) {
        if (e instanceof AriaRateLimitError) {
          startRateLimitHint(e.retryAfterSec);
        }
      } finally {
        setActionBusy(false);
      }
    },
    [actionBusy, actionCooldown, userId, resolveUserId, showInnerThought, startActionCooldown, startRateLimitHint]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = await resolveUserId();
      if (cancelled) return;
      setUserId(uid);
      if (uid) {
        const next = await fetchAriaState(uid);
        if (!cancelled && next) setState(next);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveUserId]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      let cancelled = false;

      const onFocus = async () => {
        const uid = userId ?? (await resolveUserId());
        if (!uid || cancelled) return;
        if (!userId) setUserId(uid);
        await refreshState(uid);
        await loadPending(uid);
      };

      void onFocus();

      pollTimerRef.current = setInterval(() => {
        if (focusedRef.current) void pollTick();
      }, POLL_MS);

      return () => {
        cancelled = true;
        focusedRef.current = false;
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setPendingBubble('');
      };
    }, [userId, resolveUserId, refreshState, loadPending, pollTick])
  );

  useEffect(
    () => () => {
      clearThoughtTimer();
      if (cooldownTickRef.current) clearInterval(cooldownTickRef.current);
      if (actionCooldownTimerRef.current) clearTimeout(actionCooldownTimerRef.current);
    },
    [clearThoughtTimer]
  );

  const canHeal = state.hurt >= 0.5;
  const buttonsDisabled = actionBusy || actionCooldown;

  return {
    state,
    loading,
    innerThought,
    pendingBubble,
    cooldownHint,
    buttonsDisabled,
    canHeal,
    performAction };
}
