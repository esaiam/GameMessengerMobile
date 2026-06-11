import { useCallback, useMemo, useRef, useState } from 'react';
import {
  adjustMediaTransitionRectForScroll,
  isValidMediaTransitionRect,
} from '../../components/contactProfile/mediaTransitionSource';

/**
 * Hero media viewer: state, transition rects, scroll compensation, handlers.
 */
export function useContactProfileMediaViewer({
  mediaItems,
  mediaSelectionMode,
  toggleMediaSelection,
}) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [openedMediaId, setOpenedMediaId] = useState(null);
  /** Плитка скрыта в сетке, пока viewer открыт / идёт close fly-out */
  const [hiddenTileId, setHiddenTileId] = useState(null);
  /** Rect плитки при open (hero transition source). */
  const [viewerOriginLayout, setViewerOriginLayout] = useState(null);
  const [viewerOpenEpoch, setViewerOpenEpoch] = useState(0);
  const transitionSourcesRef = useRef(new Map());
  const transitionMeasureFnsRef = useRef(new Map());
  const profileScrollYRef = useRef(0);
  const profileScrollYAtOpenRef = useRef(0);
  const mediaViewerRef = useRef(null);
  const viewerOpeningRef = useRef(false);

  const viewerItems = useMemo(
    () =>
      mediaItems
        .filter((m) => m.media_url)
        .map((m) => ({
          id: m.id,
          uri: m.media_url,
          kind: m.message_type === 'video' ? 'video' : 'image',
        })),
    [mediaItems],
  );

  const handleTileLayout = useCallback((id, layout) => {
    if (isValidMediaTransitionRect(layout)) {
      transitionSourcesRef.current.set(id, layout);
    }
  }, []);

  const handleRegisterTransitionSource = useCallback((id, fn) => {
    if (fn) transitionMeasureFnsRef.current.set(id, fn);
    else transitionMeasureFnsRef.current.delete(id);
  }, []);

  const getTransitionSource = useCallback((itemId) => {
    const rect = transitionSourcesRef.current.get(itemId);
    return isValidMediaTransitionRect(rect) ? rect : null;
  }, []);

  /** Свежий measureInWindow плитки перед close fly-out. */
  const remeasureTransitionSource = useCallback((itemId) => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (layout) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (isValidMediaTransitionRect(layout)) {
          transitionSourcesRef.current.set(itemId, layout);
          resolve(layout);
          return;
        }
        resolve(getTransitionSource(itemId));
      };
      const timer = setTimeout(() => finish(getTransitionSource(itemId)), 120);
      const measure = transitionMeasureFnsRef.current.get(itemId);
      if (!measure) {
        finish(getTransitionSource(itemId));
        return;
      }
      try {
        measure((layout) => finish(layout));
      } catch {
        finish(getTransitionSource(itemId));
      }
    });
  }, [getTransitionSource]);

  const rememberProfileScrollY = useCallback((e) => {
    profileScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const wrapProfileScrollEnd = useCallback(
    (handler) => (e) => {
      rememberProfileScrollY(e);
      handler?.(e);
    },
    [rememberProfileScrollY],
  );

  /** Window-rect ячейки с учётом скролла профиля с момента open. */
  const getCloseTransitionSource = useCallback(() => {
    const mediaId = openedMediaId;
    const base =
      (mediaId ? getTransitionSource(mediaId) : null) ??
      (isValidMediaTransitionRect(viewerOriginLayout) ? viewerOriginLayout : null);
    if (!base) return null;
    const scrollDelta = profileScrollYRef.current - profileScrollYAtOpenRef.current;
    return adjustMediaTransitionRectForScroll(base, scrollDelta);
  }, [openedMediaId, viewerOriginLayout, getTransitionSource]);

  const handleMediaPress = useCallback(
    (item, layout) => {
      if (!item?.media_url) return;
      if (viewerVisible || viewerOpeningRef.current) return;
      if (mediaSelectionMode) {
        toggleMediaSelection(item.id);
        return;
      }
      const measured = layout ?? getTransitionSource(item.id);
      if (isValidMediaTransitionRect(measured)) {
        transitionSourcesRef.current.set(item.id, measured);
      }
      const idx = viewerItems.findIndex((m) => m.id === item.id);
      if (idx < 0) return;

      viewerOpeningRef.current = true;
      setViewerIndex(idx);
      setViewerOriginLayout(measured);
      setOpenedMediaId(item.id);
      profileScrollYAtOpenRef.current = profileScrollYRef.current;

      setViewerOpenEpoch((e) => e + 1);
      setViewerVisible(true);
      viewerOpeningRef.current = false;
      // Modal монтируется на следующий кадр — не прятать плитку раньше hero.
      requestAnimationFrame(() => {
        setHiddenTileId(item.id);
      });
    },
    [viewerItems, viewerVisible, mediaSelectionMode, toggleMediaSelection, getTransitionSource],
  );

  const handoffMediaViewerTile = useCallback(() => {
    setHiddenTileId(null);
  }, []);

  const dismissMediaViewer = useCallback(() => {
    viewerOpeningRef.current = false;
    setViewerVisible(false);
    setOpenedMediaId(null);
    setViewerOriginLayout(null);
  }, []);

  /** Сброс viewer при входе в selection (long press). */
  const dismissViewerForSelection = useCallback(() => {
    viewerOpeningRef.current = false;
    setViewerVisible(false);
    setHiddenTileId(null);
    setOpenedMediaId(null);
    setViewerOriginLayout(null);
  }, []);

  const handleViewerIndexChange = useCallback(
    (nextIndex) => {
      const id = viewerItems[nextIndex]?.id;
      setViewerIndex(nextIndex);
      if (!id) return;
      setOpenedMediaId(id);
      setHiddenTileId(id);
      const layout = getTransitionSource(id);
      if (layout) setViewerOriginLayout(layout);
    },
    [viewerItems, getTransitionSource],
  );

  return {
    mediaViewerRef,
    viewerVisible,
    viewerIndex,
    viewerOriginLayout,
    viewerOpenEpoch,
    viewerItems,
    hiddenTileId,
    handleTileLayout,
    handleRegisterTransitionSource,
    getTransitionSource,
    remeasureTransitionSource,
    getCloseTransitionSource,
    handleMediaPress,
    handoffMediaViewerTile,
    dismissMediaViewer,
    dismissViewerForSelection,
    handleViewerIndexChange,
    wrapProfileScrollEnd,
  };
}
