import React from 'react';
import { View, Animated } from 'react-native';
import { V } from '../../../theme';
import ChatReplyPreview from '../ChatReplyPreview';
import ChatVideoPlaceholder from '../ChatVideoPlaceholder';
import MessageRowTimeMeta from './MessageRowTimeMeta';
import { VIDEO_FEED_CIRCLE_IDLE, REACTION_OVERLAY_ROW_RESERVE } from '../messageBubbleLayoutConstants';

const videoEdgeStripStyle = { flex: 1, alignSelf: 'stretch' };

export default function MessageRowVideoContent({
  item,
  isMine,
  isVideoRenderable,
  isEphemeral,
  listExtra,
  env,
  replyMsg,
  reactionsBar,
  bounceAnimVideo,
  ariaPanelUserAsIncoming,
  hasReactions,
}) {
  const videoCircleAnchorStyle = {
    position: 'relative',
    alignSelf: 'flex-start',
    ...(hasReactions ? { marginBottom: REACTION_OVERLAY_ROW_RESERVE } : {}),
  };
  /* Клип круга — только внутри VideoMessage (Animated.View + overflow: hidden). Здесь без overflow: hidden — иначе предок expo-video ломает композицию вместе с нативным драйвером на строке. */
  const videoCircleChrome = {
    borderRadius: VIDEO_FEED_CIRCLE_IDLE / 2,
    ...(isEphemeral ? { borderWidth: 0.5, borderColor: V.accentGold } : {}),
  };
  const showNativeVideo = isVideoRenderable && !listExtra.suppressHeavyMedia;
  const videoCircleNode = (
    <View style={videoCircleAnchorStyle}>
      <Animated.View style={{ transform: [{ scale: bounceAnimVideo }] }}>
        <View style={{ ...videoCircleChrome, alignSelf: 'flex-start' }}>
          {showNativeVideo
            ? env.renderMessageContent(item, isMine)
            : (
              <ChatVideoPlaceholder
                isUploading={item._isOptimistic === true}
                onPress={() => listExtra.onUnlockVideo?.(item.id)}
              />
            )}
        </View>
      </Animated.View>
      {reactionsBar}
    </View>
  );
  const videoTimeOverlayStyle = {
    position: 'absolute',
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 10,
    ...(isMine ? { right: 8 } : { left: 8 }),
  };

  return (
    <>
      <ChatReplyPreview replyMsg={replyMsg} />
      <View style={{ position: 'relative', width: '100%', alignSelf: 'stretch' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            width: '100%',
            alignSelf: 'stretch',
          }}
        >
          {isMine ? (
            <>
              <View style={videoEdgeStripStyle} />
              {videoCircleNode}
            </>
          ) : (
            <>
              {videoCircleNode}
              <View style={videoEdgeStripStyle} />
            </>
          )}
        </View>
        <View style={videoTimeOverlayStyle} pointerEvents="none">
          <MessageRowTimeMeta
            item={item}
            isMine={isMine}
            ariaPanelUserAsIncoming={ariaPanelUserAsIncoming}
            variant="legacy"
            tickPausedRef={env.ephemeralTickPausedRef}
          />
        </View>
      </View>
    </>
  );
}
