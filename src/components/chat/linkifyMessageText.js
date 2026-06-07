import React, { useMemo } from 'react';
import { Text, Linking } from 'react-native';
import { V } from '../../theme';

/** `[label](https://…)` или голый https:// — без bold/lists и прочего markdown. */
const LINK_TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>[\]()"']+)/g;

function tokenizeLinks(text) {
  const parts = [];
  let last = 0;
  LINK_TOKEN_RE.lastIndex = 0;
  let match = LINK_TOKEN_RE.exec(text);
  while (match) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) });
    }
    if (match[1] && match[2]) {
      parts.push({ type: 'link', label: match[1], url: match[2] });
    } else if (match[3]) {
      parts.push({ type: 'link', label: match[3], url: match[3] });
    }
    last = match.index + match[0].length;
    match = LINK_TOKEN_RE.exec(text);
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  return parts;
}

function openUrl(url) {
  Linking.openURL(url).catch(() => {});
}

/**
 * Plain text + кликабельные ссылки (Aria: без markdown-оформления текста).
 */
export function LinkifyMessageText({ text, style, linkStyle, selectable = false }) {
  const body = typeof text === 'string' ? text : '';
  const trimmed = body.trim();
  const parts = useMemo(
    () => (trimmed ? tokenizeLinks(body) : []),
    [body, trimmed],
  );

  if (!trimmed) return null;

  const linkStyles = linkStyle ?? {
    color: V.accentSage,
    textDecorationLine: 'underline',
  };

  if (parts.length === 1 && parts[0].type === 'text') {
    return (
      <Text style={style} selectable={selectable}>
        {parts[0].value}
      </Text>
    );
  }

  return (
    <Text style={style} selectable={selectable}>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <Text
            key={`link-${i}`}
            style={linkStyles}
            selectable={selectable}
            onPress={() => openUrl(part.url)}
            accessibilityRole="link"
          >
            {part.label}
          </Text>
        ) : (
          <Text key={`text-${i}`} selectable={selectable}>
            {part.value}
          </Text>
        ),
      )}
    </Text>
  );
}
