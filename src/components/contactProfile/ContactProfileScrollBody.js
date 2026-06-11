import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GAME_NO_OVERSCROLL_PROPS } from '../../theme';
import { PROFILE_COLLAPSE_DISTANCE } from '../../hooks/useProfileCollapseHeader';
import ContactProfileMediaSection from './ContactProfileMediaSection';
import { styles } from '../../screens/contactProfile/contactProfileScreenStyles';

export default function ContactProfileScrollBody({
  scrollRef,
  scrollTopPadding,
  scrollContentPullStyle,
  scrollSnapHandler,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  wrapProfileScrollEnd,
  bottomInset,
  minScrollContentHeight,
  mediaItems,
  mediaLoading,
  roomId,
  selectionMode,
  selectedIds,
  hiddenTileId,
  onMediaPress,
  onMediaLongPress,
  onTileLayout,
  onRegisterTransitionSource,
}) {
  return (
    <Animated.ScrollView
      ref={scrollRef}
      {...GAME_NO_OVERSCROLL_PROPS}
      nestedScrollEnabled
      scrollEventThrottle={16}
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: scrollTopPadding,
          paddingBottom: PROFILE_COLLAPSE_DISTANCE + bottomInset + 16,
          minHeight: minScrollContentHeight,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onScroll={scrollSnapHandler}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={wrapProfileScrollEnd(onScrollEndDrag)}
      onMomentumScrollEnd={wrapProfileScrollEnd(onMomentumScrollEnd)}
    >
      <Animated.View style={scrollContentPullStyle}>
        <View style={styles.sectionSpacer} />

        <ContactProfileMediaSection
          items={mediaItems}
          loading={mediaLoading}
          roomId={roomId}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          hiddenTileId={hiddenTileId}
          onMediaPress={onMediaPress}
          onMediaLongPress={onMediaLongPress}
          onTileLayout={onTileLayout}
          onRegisterTransitionSource={onRegisterTransitionSource}
        />
      </Animated.View>
    </Animated.ScrollView>
  );
}
