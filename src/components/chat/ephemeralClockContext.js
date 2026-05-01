import { createContext } from 'react';

/** Тик 1 с только для сгорающих сообщений; обновляют только EphemeralCountdown (context). */
export const EphemeralClockContext = createContext(0);
