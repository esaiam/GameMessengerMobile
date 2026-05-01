import { useEffect } from 'react';

/**
 * Локальный чат Aria: история не грузится из Supabase — убираем оверлей загрузки и показываем ленту.
 *
 * @param {boolean} isAriaChat
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setMessagesLoading
 * @param {import('react-native-reanimated').SharedValue<number>} listOpacity
 */
export function useAriaChatListBootstrap(isAriaChat, setMessagesLoading, listOpacity) {
  useEffect(() => {
    if (isAriaChat) {
      setMessagesLoading(false);
      listOpacity.value = 1;
    }
  }, [isAriaChat, listOpacity]);
}
