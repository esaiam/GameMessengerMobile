import { Platform, UIManager, LayoutAnimation } from 'react-native';

/** Длительность анимации reply-плашки (Reanimated) и LayoutAnimation.configureNext */
export const REPLY_TARGET_ANIM_MS = 180;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function configureReplyTargetLayoutAnimation() {
  LayoutAnimation.configureNext({
    duration: REPLY_TARGET_ANIM_MS,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}
