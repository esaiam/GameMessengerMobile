import React, { useCallback, useRef } from 'react';
import { Animated as RNAnimated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus } from '../../icons/lucideIcons';
import { MESSENGER_HEADER_PADDING_HORIZONTAL } from '../MessengerHeaderLayout';
import { TAB_BAR_LAYOUT, V } from '../../theme';

export const CONTACTS_INVITE_FAB_SIZE = 56;
const INVITE_ICON_SIZE = 24;
const TAB_CLEARANCE_PX = 12;

export default function ContactsInviteFab({ onPress }) {
  const insets = useSafeAreaInsets();
  const scaleX = useRef(new RNAnimated.Value(1)).current;
  const scaleY = useRef(new RNAnimated.Value(1)).current;
  const runAnimRef = useRef(null);

  const bottomOffset =
    insets.bottom
    + TAB_BAR_LAYOUT.screenBottomGap
    + TAB_BAR_LAYOUT.topPad
    + TAB_BAR_LAYOUT.shellHeight
    + TAB_CLEARANCE_PX;

  const onPressIn = useCallback(() => {
    runAnimRef.current?.stop?.();
    scaleX.stopAnimation?.();
    scaleY.stopAnimation?.();
    scaleX.setValue(1);
    scaleY.setValue(1);

    const anim = RNAnimated.sequence([
      RNAnimated.parallel([
        RNAnimated.timing(scaleX, {
          toValue: 1.08,
          duration: 95,
          useNativeDriver: true,
        }),
        RNAnimated.timing(scaleY, {
          toValue: 0.84,
          duration: 95,
          useNativeDriver: true,
        }),
      ]),
      RNAnimated.parallel([
        RNAnimated.spring(scaleX, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        RNAnimated.spring(scaleY, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]),
    ]);

    runAnimRef.current = anim;
    anim.start();
  }, [scaleX, scaleY]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.wrap,
        {
          bottom: bottomOffset,
          right: MESSENGER_HEADER_PADDING_HORIZONTAL,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Коды приглашений"
    >
      <RNAnimated.View
        style={[
          styles.circle,
          {
            width: CONTACTS_INVITE_FAB_SIZE,
            height: CONTACTS_INVITE_FAB_SIZE,
            borderRadius: CONTACTS_INVITE_FAB_SIZE / 2,
            transform: [{ scaleX }, { scaleY }],
          },
        ]}
      >
        <UserPlus size={INVITE_ICON_SIZE} color={V.accentSage} strokeWidth={1.5} />
      </RNAnimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 3,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.sageSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.sageBorder,
  },
});
