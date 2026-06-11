import React from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '../../icons/lucideIcons';
import { V } from '../../theme';
import ContactProfileViewerSlide from './ContactProfileViewerSlide';

export default function ContactProfileMediaViewerView({
  visible,
  items,
  count,
  screenW,
  screenH,
  slideIndex,
  effectivePhase,
  heroItem,
  pagerLayerActive,
  isInteractable,
  requestClose,
  panGesture,
  backdropStyle,
  heroFrameStyle,
  pagerX,
}) {
  const insets = useSafeAreaInsets();

  const pagerStripStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: count * screenW,
    height: screenH,
    transform: [{ translateX: pagerX.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={panGesture}>
          <View collapsable={false} style={styles.pagerClip}>
            {effectivePhase && heroItem ? (
              <Animated.View
                pointerEvents={isInteractable ? 'auto' : 'none'}
                style={heroFrameStyle}
                collapsable={false}
              >
                <View style={styles.heroStack} collapsable={false}>
                  <View
                    style={[styles.heroBaseLayer, pagerLayerActive && styles.heroLayerHidden]}
                    pointerEvents="none"
                  >
                    <ContactProfileViewerSlide
                      key={heroItem.id}
                      item={heroItem}
                      fill
                      active
                      showVideoControls={effectivePhase === 'ready' && !pagerLayerActive}
                    />
                  </View>
                  {pagerLayerActive ? (
                    <Animated.View
                      style={[styles.heroPagerLayer, pagerStripStyle]}
                      pointerEvents="auto"
                      collapsable={false}
                    >
                      {items.map((item, index) => (
                        <ContactProfileViewerSlide
                          key={item.id}
                          item={item}
                          width={screenW}
                          height={screenH}
                          active={index === slideIndex}
                          showVideoControls={pagerLayerActive && index === slideIndex}
                        />
                      ))}
                    </Animated.View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8, opacity: isInteractable ? 1 : 0 }]}
          onPress={requestClose}
          disabled={!isInteractable}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
        >
          <X size={18} color={V.textPrimary} strokeWidth={1.5} />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  pagerClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  heroStack: {
    flex: 1,
    overflow: 'hidden',
  },
  heroBaseLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroPagerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroLayerHidden: {
    opacity: 0,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    borderRadius: 999,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
