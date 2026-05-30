import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Animated,
  Image,
  ActivityIndicator,
  type ImageSourcePropType,
} from 'react-native';
import { VideoView, type VideoPlayer } from 'expo-video';
import { V } from '../../theme';

interface VideoMessageCircleProps {
  player: VideoPlayer | null;
  showVideo: boolean;
  borderRadius: Animated.AnimatedInterpolation<string | number>;
  showVeil: boolean;
  veilPosterSource: ImageSourcePropType;
  showThumb: boolean;
  thumbUri: string | null;
  isUploading: boolean;
}

export default function VideoMessageCircle({
  player,
  showVideo,
  borderRadius,
  showVeil,
  veilPosterSource,
  showThumb,
  thumbUri,
  isUploading,
}: VideoMessageCircleProps) {
  return (
    <Animated.View
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: V.bgElevated,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: V.border,
      }}
    >
      {showVideo && player ? (
        <VideoView
          pointerEvents="none"
          player={player}
          style={[StyleSheet.absoluteFill, styles.videoLayer]}
          contentFit="cover"
          nativeControls={false}
          {...(Platform.OS === 'android' ? { surfaceType: 'textureView' } : {})}
        />
      ) : null}

      {showVeil ? (
        <View style={[StyleSheet.absoluteFill, styles.veilLayer]} pointerEvents="none">
          <Image
            source={veilPosterSource}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      {showThumb && thumbUri ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.thumbLayer]}>
          <Animated.Image
            source={{ uri: thumbUri }}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {isUploading ? (
        <View style={[StyleSheet.absoluteFill, styles.uploadOverlay]} pointerEvents="none">
          <ActivityIndicator size="small" color={V.accentSage} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  videoLayer: {
    zIndex: 1,
  },
  veilLayer: {
    zIndex: 3,
  },
  thumbLayer: {
    zIndex: 2,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 15, 20, 0.42)',
  },
});
