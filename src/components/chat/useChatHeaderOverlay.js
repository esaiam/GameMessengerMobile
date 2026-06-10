import { useState, useEffect, useMemo } from 'react';
import { TouchableOpacity } from 'react-native';
import { ICON_SELECTION_ACTION } from '../ChatRoomHeader';
import { getAriaComposerSurfaceProps } from './ariaComposerSurfaceProps';
import { CHAT_HEADER_TO_LIST_GAP_PX } from './chatViewConstants';
import { EllipsisVertical } from '../../icons/lucideIcons';
import { V } from '../../theme';

/**
 * Frosted header overlay layout: heights for header/pinned/Aria gauges, list padding, composer Aria props.
 * Depends on: chatRoomHeader, onTopOverlayHeight, isAriaChat, listPaddingTop, roomId, setOverflowMenuVisible.
 */
export default function useChatHeaderOverlay({
  chatRoomHeader,
  onTopOverlayHeight,
  isAriaChat,
  listPaddingTop,
  roomId,
  setOverflowMenuVisible,
}) {
  const [headerOverlayH, setHeaderOverlayH] = useState(0);
  const [pinnedBarH, setPinnedBarH] = useState(0);
  const [ariaGaugesH, setAriaGaugesH] = useState(48);
  const [ariaState, setAriaState] = useState(null);

  useEffect(() => {
    if (chatRoomHeader == null) return;
    if (headerOverlayH <= 0) return;
    const gaugesH = isAriaChat ? ariaGaugesH : 0;
    const pinH = !isAriaChat && pinnedBarH > 0 ? pinnedBarH : 0;
    onTopOverlayHeight?.(headerOverlayH + gaugesH + pinH);
  }, [chatRoomHeader, headerOverlayH, isAriaChat, ariaGaugesH, pinnedBarH, onTopOverlayHeight]);

  const listFooterPaddingTop =
    chatRoomHeader != null &&
    typeof listPaddingTop === 'number' &&
    listPaddingTop > 0
      ? listPaddingTop + CHAT_HEADER_TO_LIST_GAP_PX + (pinnedBarH > 0 ? pinnedBarH : 0)
      : listPaddingTop;

  const ariaComposerSurfaceProps = useMemo(
    () => getAriaComposerSurfaceProps(isAriaChat, chatRoomHeader?.ariaOnline),
    [isAriaChat, chatRoomHeader?.ariaOnline],
  );

  const headerRightTrailingEl = useMemo(() => {
    if (isAriaChat || !roomId || !chatRoomHeader?.headerRight) return undefined;
    return (
      <TouchableOpacity
        onPress={() => setOverflowMenuVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Меню чата"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
      >
        <EllipsisVertical size={ICON_SELECTION_ACTION} color={V.textPrimary} strokeWidth={1.5} />
      </TouchableOpacity>
    );
  }, [isAriaChat, roomId, chatRoomHeader?.headerRight, setOverflowMenuVisible]);

  return {
    headerOverlayH,
    setHeaderOverlayH,
    pinnedBarH,
    setPinnedBarH,
    ariaGaugesH,
    setAriaGaugesH,
    ariaState,
    setAriaState,
    listFooterPaddingTop,
    ariaComposerSurfaceProps,
    headerRightTrailingEl,
  };
}
