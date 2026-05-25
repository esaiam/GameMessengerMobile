import { createContext, useContext } from 'react';

export const PagerGestureContext = createContext(null);

export function usePagerGesture() {
  return useContext(PagerGestureContext);
}
