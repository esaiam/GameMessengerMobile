import React from 'react';
import { Text } from 'react-native';
import { V } from '../../../theme';
import ChatEphemeralCountdown from '../ChatEphemeralCountdown';
import ChatReadCheck from '../ChatReadCheck';
import {
  TS_TEXT_SIZE,
  META_RESERVE_PX_INCOMING,
  META_RESERVE_PX_OUTGOING,
  META_RESERVE_PX_EPHEMERAL_EXTRA,
} from '../messageBubbleLayoutConstants';

function getMessageRowTimeColor(isMine, ariaPanelUserAsIncoming, variant) {
  const asOutgoing = isMine && !ariaPanelUserAsIncoming;
  if (variant === 'text') {
    return asOutgoing ? V.outBubbleTime : V.inBubbleTime;
  }
  return asOutgoing
    ? 'rgba(186, 222, 218, 0.52)'
    : 'rgba(168, 162, 152, 0.58)';
}

/** Padding-right under text body so inline time meta does not overlap message text. */
export function computeMessageRowMetaReservePx({ isMine, isEphemeral, isEdited }) {
  return (
    (isMine ? META_RESERVE_PX_OUTGOING : META_RESERVE_PX_INCOMING) +
    (isEphemeral ? META_RESERVE_PX_EPHEMERAL_EXTRA : 0) +
    (isEdited ? 24 : 0)
  );
}

export default function MessageRowTimeMeta({
  item,
  isMine,
  ariaPanelUserAsIncoming,
  variant = 'text',
  tickPausedRef,
}) {
  const isEphemeral = !!item.expires_at;
  const isEdited = !!item.edited_at;
  const timeColor = getMessageRowTimeColor(isMine, ariaPanelUserAsIncoming, variant);

  return (
    <>
      {isEphemeral ? (
        <ChatEphemeralCountdown expiresAt={item.expires_at} tickPausedRef={tickPausedRef} />
      ) : null}
      {isEdited ? (
        <Text style={{ fontSize: TS_TEXT_SIZE - 1, color: timeColor, fontWeight: '400' }}>
          изм.
        </Text>
      ) : null}
      <Text style={{ fontSize: TS_TEXT_SIZE, color: timeColor, fontWeight: '400' }}>
        {item._formattedTime}
      </Text>
      <ChatReadCheck
        isRead={!!item.read_at}
        isMine={isMine}
        variant={variant === 'overlay' ? 'overlay' : undefined}
      />
    </>
  );
}
