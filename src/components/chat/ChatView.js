import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw from 'twrnc';
import Reanimated from 'react-native-reanimated';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import ChatRoomHeader from '../ChatRoomHeader';
import ChatOverlays from './ChatOverlays';
import { EphemeralClockContext } from './ephemeralClockContext';
import ChatMessageList from './ChatMessageList';
import ChatComposer from './ChatComposer';
import ChatRoomWallpaper from './ChatRoomWallpaper';
import AriaStateGauges from './AriaStateGauges';
import ChatPinnedBar from './ChatPinnedBar';
import { V } from '../../theme';

/** Presentational shell: wallpaper, overlays, message list, composer, frosted header. */
export default function ChatView({
  ephemeralClockTick,
  chatRoomHeader,
  isAriaChat,
  uiReady,
  insets,
  listViewportStyle,
  overlayProps,
  listProps,
  composerProps,
  headerShell,
}) {
  const {
    headerOverlayH,
    pinnedBarH,
    headerRightTrailingEl,
    ariaState,
    pinnedMessage,
    selectionMode,
    selectedIds,
    setHeaderOverlayH,
    setPinnedBarH,
    setAriaState,
    setAriaGaugesH,
    exitSelectionMode,
    batchCopySelected,
    batchForwardSelected,
    batchDeleteForMe,
    scrollToMessageById,
    unpinMessage,
  } = headerShell;

  return (
    <EphemeralClockContext.Provider value={ephemeralClockTick}>
      <Reanimated.View
        style={[
          tw`flex-1`,
          {
            backgroundColor: V.bgApp,
            overflow: chatRoomHeader ? 'visible' : 'hidden',
          },
        ]}
      >
        <ChatRoomWallpaper />
        <ChatOverlays {...overlayProps} />

        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Reanimated.View style={[{ flex: 1 }, listViewportStyle]}>
            <ChatMessageList {...listProps} />
          </Reanimated.View>

          <KeyboardStickyView
            pointerEvents="box-none"
            offset={{ closed: 0, opened: 0 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              elevation: 2,
            }}
          >
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(13, 15, 20, 0.35)']}
              locations={[0, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: 80,
              }}
            />
            <ChatComposer {...composerProps} insets={insets} uiReady={uiReady} />
          </KeyboardStickyView>
        </View>

        {chatRoomHeader != null ? (
          <>
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                elevation: 50,
              }}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0) setHeaderOverlayH(h);
              }}
            >
              <ChatRoomHeader
                title={chatRoomHeader.title}
                peerHandle={chatRoomHeader.peerHandle}
                contactOnline={chatRoomHeader.contactOnline}
                navigation={chatRoomHeader.navigation}
                ariaOnline={chatRoomHeader.ariaOnline}
                headerRight={chatRoomHeader.headerRight}
                headerRightTrailing={headerRightTrailingEl}
                topPaddingOverride={chatRoomHeader.topPaddingOverride}
                onAriaStateChange={isAriaChat ? setAriaState : undefined}
                onHeaderPress={chatRoomHeader.onHeaderPress}
                selectionMode={selectionMode}
                selectedCount={selectedIds.size}
                onExitSelection={exitSelectionMode}
                onCopy={batchCopySelected}
                onForward={batchForwardSelected}
                onDelete={batchDeleteForMe}
              />
            </View>

            {isAriaChat ? (
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  top: headerOverlayH,
                  left: 0,
                  right: 0,
                  zIndex: 49,
                  elevation: 49,
                }}
              >
                <AriaStateGauges state={ariaState} onHeightChange={setAriaGaugesH} />
              </View>
            ) : pinnedMessage ? (
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  top: headerOverlayH,
                  left: 0,
                  right: 0,
                  zIndex: 49,
                  elevation: 49,
                }}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && h !== pinnedBarH) setPinnedBarH(h);
                }}
              >
                <ChatPinnedBar
                  message={pinnedMessage}
                  onPress={() => scrollToMessageById(pinnedMessage.id)}
                  onUnpin={unpinMessage}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Reanimated.View>
    </EphemeralClockContext.Provider>
  );
}
