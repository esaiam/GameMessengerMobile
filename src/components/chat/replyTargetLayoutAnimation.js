import { Platform, UIManager, LayoutAnimation } from 'react-native';

/** Длительность анимации reply-плашки (Reanimated) и LayoutAnimation.configureNext */
export const REPLY_TARGET_ANIM_MS = 180;

// In RN New Architecture this flag is a no-op; keep legacy behavior only.
if (Platform.OS === 'android') {
  const setExperimental = UIManager?.setLayoutAnimationEnabledExperimental;
  if (typeof setExperimental === 'function') {
    try {
      setExperimental(true);
    } catch {
      // ignore — no-op / unsupported in some runtimes
    }
  }
}

export function configureReplyTargetLayoutAnimation() {
  LayoutAnimation.configureNext({
    duration: REPLY_TARGET_ANIM_MS,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity } });
}
