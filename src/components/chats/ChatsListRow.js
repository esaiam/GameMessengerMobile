import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import tw from 'twrnc';
import { AriaGradientAvatar } from '../chat/AriaChatUi';
import { V } from '../../theme';
import { messagePreview } from '../../screens/chats/chatsPreviewCache';
import { formatChatListTime, getInitials } from '../../screens/chats/chatsFormat';

function Avatar({ name }) {
  return (
    <View
      style={[
        tw`w-14 h-14 rounded-full items-center justify-center`,
        { backgroundColor: V.outBubbleBg }]}
    >
      <Text style={[tw`text-[13px] font-medium`, { color: V.accentSage }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const ChatsListRow = React.memo(
  function ChatsListRow({ item, onPress }) {
    const ts = item.last?.created_at || null;
    const preview = item.isAria ? 'Привет. Я здесь.' : messagePreview(item.last, item.roomCode);
    const [layout, setLayout] = useState({ w: 0, h: 0 });
    const [ripple, setRipple] = useState({ visible: false, x: 0, y: 0 });
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const rippleAnimRef = useRef(null);
    const navigateTimerRef = useRef(null);

    const maxD =
      layout.w > 0 && layout.h > 0
        ? Math.ceil(Math.sqrt(layout.w * layout.w + layout.h * layout.h) * 2)
        : 0;

    useLayoutEffect(() => {
      if (!ripple.visible || maxD <= 0) return undefined;
      rippleAnimRef.current?.stop?.();
      const anim = Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true })])]);
      rippleAnimRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) {
          scaleAnim.setValue(0);
          opacityAnim.setValue(0);
          setRipple((r) => ({ ...r, visible: false }));
        }
      });
      return () => anim.stop();
    }, [ripple.visible, ripple.x, ripple.y, maxD, scaleAnim, opacityAnim]);

    const onPressIn = useCallback(
      (e) => {
        const { locationX, locationY } = e.nativeEvent;
        rippleAnimRef.current?.stop?.();
        scaleAnim.setValue(0);
        opacityAnim.setValue(1);
        setRipple({ visible: true, x: locationX, y: locationY });
      },
      [scaleAnim, opacityAnim]
    );

    const handlePress = useCallback(() => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = setTimeout(() => {
        navigateTimerRef.current = null;
        onPress();
      }, 0);
    }, [onPress]);

    useEffect(
      () => () => {
        if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
      },
      []
    );

    return (
      <View
        style={[tw`pt-0 pb-5`, {overflow: 'hidden'}]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setLayout((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
        }}
      >
        <Pressable onPressIn={onPressIn} onPress={handlePress} android_ripple={null}>
          {ripple.visible && maxD > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: ripple.x - maxD / 2,
                top: ripple.y - maxD / 2,
                width: maxD,
                height: maxD,
                borderRadius: maxD / 2,
                backgroundColor: 'rgba(90, 158, 154, 0.2)',
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim }}
            />
          ) : null}
          <View style={tw`flex-row items-center`}>
            {item.isAria ? <AriaGradientAvatar size={56} /> : <Avatar name={item.contactName} />}
            <View style={tw`flex-1 ml-3`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center flex-1 min-w-0 mr-2`}>
                  <Text style={[tw`text-[15px] font-medium`, { color: V.textPrimary }]} numberOfLines={1}>
                    {item.contactName}
                  </Text>
                  {item.isAria ? (
                    <Text
                      style={[tw`text-[10px] font-medium ml-1.5`, { color: V.accentSage, opacity: 0.8 }]}
                    >
                      AI
                    </Text>
                  ) : null}
                </View>
                <Text style={[tw`text-[10px]`, { color: V.textMuted }]}>
                  {formatChatListTime(ts)}
                </Text>
              </View>
              <Text style={[tw`text-[12px] mt-0.5`, { color: V.textSecondary }]} numberOfLines={1}>
                {preview}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    );
  },
  (prev, next) =>
    prev.item.isAria === next.item.isAria &&
    prev.item.roomId === next.item.roomId &&
    prev.item.last?.id === next.item.last?.id &&
    prev.item.last?.created_at === next.item.last?.created_at
);

export default ChatsListRow;
