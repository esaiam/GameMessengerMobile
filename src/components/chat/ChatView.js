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
  uiReady,
  uploading,
  fullScreenImage,
  setFullScreenImage,
  calendarOverlay,
  daysWithMessages,
  handleCalendarDayPress,
  setCalendarOverlay,
  menuVisible,
  menuPosition,
  selectedMessage,
  setMenuVisible,
  setReplyTarget,
  startEditMessage,
  canEditSelectedMessage,
  setDeleteConfirmVisible,
  togglePinForMessage,
  contextMenuPinLabel,
  pinDisabled,
  deleteConfirmVisible,
  closeDeleteConfirm,
  deleteMessageForMe,
  deleteMessageForAll,
  overflowMenuVisible,
  setOverflowMenuVisible,
  setClearHistoryConfirmVisible,
  setDeleteChatConfirmVisible,
  clearHistoryConfirmVisible,
  executeClearHistory,
  deleteChatConfirmVisible,
  closeDeleteChatConfirm,
  confirmDeleteChatFromList,
  deleteChatInProgress,
  showAttachMenu,
  setShowAttachMenu,
  takePhoto,
  pickImageFromGallery,
  sendCurrentLocation,
  ephemeralSec,
  setEphemeralSec,
  roomId,
  flatListRef,
  formattedMessages,
  renderItem,
  listExtraDataStable,
  listAnimatedStyle,
  listBottomSpacerStyle,
  onListScroll,
  onListLayoutReady,
  messagesLoading,
  listPaddingTop,
  listFooterPaddingTop,
  selectionMode,
  selectedIds,
  exitSelectionMode,
  batchDeleteForMe,
  batchCopySelected,
  batchForwardSelected,
  overscrollEnabled,
  loadingOlder,
  loadOlderMessages,
  listViewportStyle,
  inputBarRef,
  reportComposerBaseHeight,
  insets,
  visibleReplyTo,
  visibleEditTarget,
  replyTargetAnimatedStyle,
  emojiPanelAnimatedStyle,
  emojiContentAnimatedStyle,
  cancelEditMessage,
  editTarget,
  showEmojiPicker,
  toggleEmojiPicker,
  insertEmoji,
  emojiWobbleRotate,
  inputRef,
  text,
  setText,
  sendMessage,
  isRecordingVoice,
  handleSendVoiceForComposer,
  setIsRecordingVoice,
  uploadMedia,
  sendMediaMessage,
  onVoiceRecorderOpen,
  handleVideoRecorded,
  handleVideoSendError,
  handleVideoUploadFinished,
  collapseEmojiForKeyboard,
  emojiPanelGifQuery,
  setEmojiPanelGifQuery,
  mediaInline,
  setEmojiPanelGifSearchFocused,
  prepareEmojiPanelGifSearch,
  releaseEmojiPanelGifSearch,
  exitGifTabLayout,
  ariaComposerSurfaceProps,
  headerOverlayH,
  setHeaderOverlayH,
  headerRightTrailingEl,
  isAriaChat,
  ariaState,
  setAriaState,
  setAriaGaugesH,
  pinnedMessage,
  pinnedBarH,
  setPinnedBarH,
  scrollToMessageById,
  unpinMessage,
}) {
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
        <ChatOverlays
          uiReady={uiReady}
          uploading={uploading}
          fullScreenImage={fullScreenImage}
          onCloseFullScreenImage={() => setFullScreenImage(null)}
          calendarOverlay={calendarOverlay}
          daysWithMessages={daysWithMessages}
          onCalendarDayPress={handleCalendarDayPress}
          onCloseCalendar={() => setCalendarOverlay(null)}
          menuVisible={menuVisible}
          menuPosition={menuPosition}
          selectedMessage={selectedMessage}
          onCloseMenu={() => setMenuVisible(false)}
          onReplyToMessage={setReplyTarget}
          onEditMessage={startEditMessage}
          canEditSelectedMessage={canEditSelectedMessage}
          onRequestDeleteConfirm={() => {
            setMenuVisible(false);
            setDeleteConfirmVisible(true);
          }}
          onOpenImage={(uri) => setFullScreenImage({ uris: [uri], index: 0 })}
          onPinMessage={togglePinForMessage}
          pinLabel={contextMenuPinLabel}
          pinDisabled={pinDisabled}
          deleteConfirmVisible={deleteConfirmVisible}
          onCloseDeleteConfirm={closeDeleteConfirm}
          onDeleteForMe={deleteMessageForMe}
          onDeleteForAll={deleteMessageForAll}
          overflowMenuVisible={overflowMenuVisible}
          onCloseOverflowMenu={() => setOverflowMenuVisible(false)}
          onClearHistory={() => setClearHistoryConfirmVisible(true)}
          onDeleteChatFromList={() => setDeleteChatConfirmVisible(true)}
          clearHistoryConfirmVisible={clearHistoryConfirmVisible}
          onCloseClearHistoryConfirm={() => setClearHistoryConfirmVisible(false)}
          onConfirmClearHistory={executeClearHistory}
          deleteChatConfirmVisible={deleteChatConfirmVisible}
          onCloseDeleteChatConfirm={closeDeleteChatConfirm}
          onConfirmDeleteChat={confirmDeleteChatFromList}
          deleteChatConfirmDisabled={deleteChatInProgress}
          showAttachMenu={showAttachMenu}
          onCloseAttachMenu={() => setShowAttachMenu(false)}
          takePhoto={takePhoto}
          pickImageFromGallery={pickImageFromGallery}
          sendCurrentLocation={sendCurrentLocation}
          ephemeralSec={ephemeralSec}
          setEphemeralSec={setEphemeralSec}
        />

        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Reanimated.View style={[{ flex: 1 }, listViewportStyle]}>
            <ChatMessageList
              roomId={roomId}
              flatListRef={flatListRef}
              formattedMessages={formattedMessages}
              renderItem={renderItem}
              listExtraDataStable={listExtraDataStable}
              listAnimatedStyle={listAnimatedStyle}
              listBottomSpacerStyle={listBottomSpacerStyle}
              onListScroll={onListScroll}
              onListLayoutReady={onListLayoutReady}
              messagesLoading={messagesLoading}
              chatRoomHeader={chatRoomHeader}
              listPaddingTop={listPaddingTop}
              listFooterPaddingTop={listFooterPaddingTop}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              exitSelectionMode={exitSelectionMode}
              batchDeleteForMe={batchDeleteForMe}
              overscrollEnabled={overscrollEnabled}
              loadingOlder={loadingOlder}
              onLoadOlderMessages={loadOlderMessages}
            />
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
            <ChatComposer
              inputBarRef={inputBarRef}
              reportComposerBaseHeight={reportComposerBaseHeight}
              insets={insets}
              visibleReplyTo={visibleReplyTo}
              visibleEditTarget={visibleEditTarget}
              replyTargetAnimatedStyle={replyTargetAnimatedStyle}
              emojiPanelAnimatedStyle={emojiPanelAnimatedStyle}
              emojiContentAnimatedStyle={emojiContentAnimatedStyle}
              onDismissReply={() => setReplyTarget(null)}
              onDismissEdit={cancelEditMessage}
              isEditingMessage={!!editTarget}
              uiReady={uiReady}
              showEmojiPicker={showEmojiPicker}
              toggleEmojiPicker={toggleEmojiPicker}
              insertEmoji={insertEmoji}
              emojiWobbleRotate={emojiWobbleRotate}
              inputRef={inputRef}
              ephemeralSec={ephemeralSec}
              text={text}
              setText={setText}
              sendMessage={sendMessage}
              isRecordingVoice={isRecordingVoice}
              setShowAttachMenu={setShowAttachMenu}
              handleSendVoice={handleSendVoiceForComposer}
              setIsRecordingVoice={setIsRecordingVoice}
              uploadMedia={uploadMedia}
              sendMediaMessage={sendMediaMessage}
              onVoiceRecorderOpen={onVoiceRecorderOpen}
              handleVideoRecorded={handleVideoRecorded}
              handleVideoSendError={handleVideoSendError}
              handleVideoUploadFinished={handleVideoUploadFinished}
              collapseEmojiForKeyboard={collapseEmojiForKeyboard}
              emojiPanelGifQuery={emojiPanelGifQuery}
              onEmojiPanelGifQueryChange={setEmojiPanelGifQuery}
              {...mediaInline}
              onEmojiPanelGifSearchFocus={() => {
                setEmojiPanelGifSearchFocused(true);
                prepareEmojiPanelGifSearch();
              }}
              onEmojiPanelGifSearchBlur={() => {
                setEmojiPanelGifSearchFocused(false);
                releaseEmojiPanelGifSearch();
              }}
              onEmojiPanelGifTabExit={() => {
                setEmojiPanelGifSearchFocused(false);
                exitGifTabLayout();
              }}
              {...ariaComposerSurfaceProps}
            />
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
