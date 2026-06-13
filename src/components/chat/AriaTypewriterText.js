import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { LinkifyMessageText } from './linkifyMessageText';
import {
  resolveAriaTypewriterChunkSize,
  resolveAriaTypewriterTickMs,
} from '../../lib/ariaTypewriter';

/**
 * Постепенно показывает текст ответа Aria (клиентский typewriter).
 * done=true — сразу полный текст (история / после анимации).
 * Обязателен key={messageId} у родителя: FlatList переиспользует ячейки.
 */
export default function AriaTypewriterText({
  text,
  done = false,
  messageId,
  onRevealComplete,
  style,
  useLinks = false,
  selectable = false,
}) {
  const fullText = typeof text === 'string' ? text : '';
  const [visibleText, setVisibleText] = useState(() => (done ? fullText : ''));
  const completedRef = useRef(done);
  const onCompleteRef = useRef(onRevealComplete);
  onCompleteRef.current = onRevealComplete;

  useEffect(() => {
    if (done) {
      completedRef.current = true;
      setVisibleText(fullText);
      return undefined;
    }

    const chars = Array.from(fullText);
    completedRef.current = false;
    setVisibleText('');

    if (chars.length === 0) {
      completedRef.current = true;
      if (messageId) onCompleteRef.current?.(messageId);
      return undefined;
    }

    let index = 0;
    const chunk = resolveAriaTypewriterChunkSize(chars.length);
    const tickMs = resolveAriaTypewriterTickMs(chars.length);

    const timer = setInterval(() => {
      index = Math.min(chars.length, index + chunk);
      setVisibleText(chars.slice(0, index).join(''));
      if (index >= chars.length) {
        clearInterval(timer);
        if (!completedRef.current) {
          completedRef.current = true;
          if (messageId) onCompleteRef.current?.(messageId);
        }
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [done, fullText, messageId]);

  const body = useLinks ? (
    <LinkifyMessageText text={visibleText} style={style} selectable={selectable} />
  ) : (
    <Text style={style} selectable={selectable}>
      {visibleText}
    </Text>
  );

  return body ?? <Text style={style}>{''}</Text>;
}
