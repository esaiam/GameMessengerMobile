import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Каждый элемент стека: { type: 'Room' | 'ChatRoom' | 'ContactProfile', params: object }
 *
 * setDetailParams(entry | null) — заменить весь стек одним экраном (или очистить)
 * pushDetail(entry)             — открыть новый экран поверх текущего
 * popDetail()                   — вернуться к предыдущему (или очистить, если был один)
 * currentDetail                 — верхний элемент стека или null
 */
export const SplitDetailContext = createContext(null);

/** Вызовы вне React (блокировка контакта, смена вкладки). */
export const splitDetailApi = {
  clearStack: null,
  clearContactProfile: null,
};

function registerSplitDetailApi(clearStack, clearContactProfile) {
  splitDetailApi.clearStack = clearStack;
  splitDetailApi.clearContactProfile = clearContactProfile;
}

function useSplitDetailApiRegistration(setStack) {
  const clearStack = useCallback(() => {
    setStack([]);
  }, [setStack]);

  const clearContactProfile = useCallback(() => {
    setStack((prev) =>
      prev.some((e) => e.type === 'ContactProfile') ? [] : prev,
    );
  }, [setStack]);

  useEffect(() => {
    registerSplitDetailApi(clearStack, clearContactProfile);
    return () => registerSplitDetailApi(null, null);
  }, [clearStack, clearContactProfile]);

  return { clearStack, clearContactProfile };
}

export function SplitDetailProvider({ children }) {
  const [stack, setStack] = useState([]);
  useSplitDetailApiRegistration(setStack);

  const setDetailParams = useCallback((entry) => {
    setStack(entry ? [entry] : []);
  }, []);

  const pushDetail = useCallback((entry) => {
    setStack((prev) => [...prev, entry]);
  }, []);

  const popDetail = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
  }, []);

  const currentDetail = stack.length > 0 ? stack[stack.length - 1] : null;

  return (
    <SplitDetailContext.Provider value={{ currentDetail, setDetailParams, pushDetail, popDetail }}>
      {children}
    </SplitDetailContext.Provider>
  );
}

export function useSplitDetail() {
  const ctx = useContext(SplitDetailContext);
  if (!ctx) {
    return {
      currentDetail: null,
      setDetailParams: () => {},
      pushDetail: () => {},
      popDetail: () => {} };
  }
  return ctx;
}
