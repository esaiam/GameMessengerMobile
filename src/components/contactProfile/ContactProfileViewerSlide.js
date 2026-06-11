import React, { useEffect } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

const styles = StyleSheet.create({
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideFill: {
    flex: 1,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
});

const ContactProfileViewerSlide = React.memo(function ContactProfileViewerSlide({
  item,
  width,
  height,
  fill = false,
  active,
  showVideoControls,
}) {
  const isVideo = item.kind === 'video';
  const boxStyle = fill ? styles.slideFill : [styles.slide, { width, height }];

  const player = useVideoPlayer(isVideo && active ? item.uri : null, (p) => {
    if (!p) return;
    p.loop = false;
  });

  useEffect(() => {
    if (!isVideo || !player || !active) return undefined;
    try {
      player.play();
    } catch {
      /* ignore */
    }
    return () => {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
    };
  }, [isVideo, player, item.uri, active]);

  if (isVideo) {
    return (
      <View style={boxStyle}>
        <VideoView
          player={player}
          style={styles.media}
          contentFit="cover"
          nativeControls={showVideoControls}
        />
      </View>
    );
  }

  return (
    <View style={boxStyle}>
      <Image
        source={{ uri: item.uri, cache: 'force-cache' }}
        style={styles.media}
        resizeMode="cover"
        fadeDuration={0}
      />
    </View>
  );
});

export default ContactProfileViewerSlide;
