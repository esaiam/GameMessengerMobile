import React, { forwardRef } from 'react';
import ContactProfileMediaViewerView from './ContactProfileMediaViewerView';
import { useContactProfileMediaViewerController } from './viewer/useContactProfileMediaViewerController';

/**
 * Hero viewer: один Animated rect (window space) + один ViewerSlide на open/close.
 *
 * @typedef {{
 *   visible: boolean,
 *   items: { id: string, uri: string, kind: 'image' | 'video' }[],
 *   viewIndex: number,
 *   initialTransitionSource?: import('./mediaTransitionSource').MediaTransitionRect | null,
 *   getTransitionSource?: (itemId: string) => import('./mediaTransitionSource').MediaTransitionRect | null | undefined,
 *   remeasureTransitionSource?: (itemId: string) => Promise<import('./mediaTransitionSource').MediaTransitionRect | null>,
 *   getCloseTransitionSource?: () => import('./mediaTransitionSource').MediaTransitionRect | null | undefined,
 *   openEpoch?: number,
 *   onHandoff?: () => void,
 *   onClose: () => void,
 *   onIndexChange?: (index: number) => void,
 * }} ContactProfileMediaViewerModalProps
 */

/** @type {React.ForwardRefRenderFunction<{ close: () => void }, ContactProfileMediaViewerModalProps>} */
const ContactProfileMediaViewerModal = forwardRef(function ContactProfileMediaViewerModal(props, ref) {
  const viewProps = useContactProfileMediaViewerController(props, ref);
  if (!viewProps) return null;
  return <ContactProfileMediaViewerView {...viewProps} />;
});

export default ContactProfileMediaViewerModal;
