import { useState, useEffect, useCallback } from 'react';

/**
 * Overlay/modal UI state for Chat: context menu, confirms, attach, fullscreen image, calendar, uiReady.
 * Pure local UI state — no external deps.
 */
export default function useChatOverlayState() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [clearHistoryConfirmVisible, setClearHistoryConfirmVisible] = useState(false);
  const [deleteChatConfirmVisible, setDeleteChatConfirmVisible] = useState(false);
  const [deleteChatInProgress, setDeleteChatInProgress] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [calendarOverlay, setCalendarOverlay] = useState(null);
  const [uiReady, setUiReady] = useState(false);

  const openFullScreenImage = useCallback((payload) => {
    if (payload == null) {
      setFullScreenImage(null);
      return;
    }
    if (typeof payload === 'string') {
      setFullScreenImage({ uris: [payload], index: 0 });
      return;
    }
    setFullScreenImage(payload);
  }, []);

  const onOpenMessageMenu = useCallback((event, item) => {
    const x = event?.nativeEvent?.pageX ?? 0;
    const y = event?.nativeEvent?.pageY ?? 0;
    setMenuPosition({ x, y });
    setSelectedMessage(item);
    setMenuVisible(true);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setUiReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return {
    menuVisible,
    setMenuVisible,
    menuPosition,
    selectedMessage,
    setSelectedMessage,
    deleteConfirmVisible,
    setDeleteConfirmVisible,
    overflowMenuVisible,
    setOverflowMenuVisible,
    clearHistoryConfirmVisible,
    setClearHistoryConfirmVisible,
    deleteChatConfirmVisible,
    setDeleteChatConfirmVisible,
    deleteChatInProgress,
    setDeleteChatInProgress,
    showAttachMenu,
    setShowAttachMenu,
    fullScreenImage,
    setFullScreenImage,
    openFullScreenImage,
    calendarOverlay,
    setCalendarOverlay,
    uiReady,
    onOpenMessageMenu,
  };
}
