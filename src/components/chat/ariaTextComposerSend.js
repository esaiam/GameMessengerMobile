/**
 * Локальный чат Aria: POST текста через sendToAria (из ChatRoomScreen).
 *
 * @param {{ trimmed: string, sendToAria: (text: string, opts?: object) => Promise<unknown>, sendInProgressRef: import('react').MutableRefObject<boolean>, setText: Function, setReplyTarget: Function }} p
 */
export async function sendAriaChatTextMessage({
  trimmed,
  sendToAria,
  sendInProgressRef,
  setText,
  setReplyTarget,
}) {
  if (sendInProgressRef.current) return;
  sendInProgressRef.current = true;
  try {
    await sendToAria(trimmed);
    setText('');
    setReplyTarget(null);
  } finally {
    sendInProgressRef.current = false;
  }
}
