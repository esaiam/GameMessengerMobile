import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated from 'react-native-reanimated';
import tw from 'twrnc';
import SafeBlurView from '../SafeBlurView';
import VoiceRecorder from './VoiceRecorder';
import {
  Send,
  X,
  Paperclip,
  Smile,
  KeyboardIcon,
  Sparkles,
} from '../../icons/lucideIcons';
import AiRewritePanel from './AiRewritePanel';
import { V, TAB_BAR_LAYOUT, COMPOSER_LAYOUT, COMPOSER_CAPSULE_RADIUS } from '../../theme';
import {
  REPLY_TARGET_PREVIEW_H,
  INPUT_BAR_ICON,
  INPUT_BAR_EMOJI_ICON,
  INPUT_BAR_CLIP_MIC_SHIFT,
  INPUT_BAR_BLUR_INTENSITY_IOS,
  INPUT_BAR_BLUR_INTENSITY_ANDROID,
  INPUT_BAR_FROST_TINT_OPACITY,
  MIC_BUTTON_SIZE,
  MIC_INNER,
  ON_SAGE_GLYPH,
  EMOJI_SET,
} from './chatComposerConstants';

/**
 * Нижний блок чата: reply-плашка, панель эмодзи, капсула ввода (blur), VoiceRecorder.
 * Внешний Reanimated-контейнер (клавиатура) остаётся в Chat.
 */
export default function ChatComposer({
  inputBarRef,
  reportInputBar,
  reportComposerBaseHeight,
  insets,
  visibleReplyTo,
  replyTargetAnimatedStyle,
  emojiPanelAnimatedStyle,
  emojiContentAnimatedStyle,
  onDismissReply,
  uiReady,
  showEmojiPicker,
  toggleEmojiPicker,
  insertEmoji,
  emojiWobbleRotate,
  inputRef,
  ephemeralSec,
  text,
  setText,
  sendMessage,
  isRecordingVoice,
  collapseEmojiForKeyboard,
  setShowAttachMenu,
  handleSendVoice,
  setIsRecordingVoice,
  uploadMedia,
  sendMediaMessage,
  onVoiceRecorderOpen,
  handleVideoRecorded,
  handleVideoSendError,
  /** Только текст + эмодзи (чат Aria: без вложений). */
  ariaTextOnly = false,
  /** Чат Aria: показать запись голоса (без вложений). */
  ariaAllowVoice = false,
  /** Сервер Aria недоступен — блок ввода и подсказка. */
  ariaUnavailable = false,
  /** Ref обёртки капсулы ввода — для геометрии скрим-градиента ленты в `Chat`. */
  capsuleWrapperRef,
}) {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  return (
    <>
      <View
        collapsable={false}
        onLayout={(e) => reportComposerBaseHeight?.(e.nativeEvent.layout.height)}
      >
        {visibleReplyTo && (
          <Reanimated.View style={[{ overflow: 'hidden' }, replyTargetAnimatedStyle]}>
            <View
              style={[
                tw`flex-row items-center px-3 py-2`,
                {
                  height: REPLY_TARGET_PREVIEW_H,
                  backgroundColor: V.bgSurface,
                  borderTopWidth: 0.5,
                  borderTopColor: V.border,
                },
              ]}
            >
              <View style={[tw`flex-1 pl-2`, { borderLeftWidth: 2, borderLeftColor: V.accentSage }]}>
                <Text style={[tw`text-[10px] font-medium`, { color: V.accentSage }]} numberOfLines={1}>
                  {visibleReplyTo.player_name}
                </Text>
                <Text style={[tw`text-[10px]`, { color: V.textSecondary }]} numberOfLines={1}>
                  {visibleReplyTo.text}
                </Text>
              </View>
              <TouchableOpacity onPress={onDismissReply} style={tw`ml-2 p-1`}>
                <X size={16} color={V.textMuted} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </Reanimated.View>
        )}

        <View
          ref={inputBarRef}
          onLayout={(e) => reportInputBar(e.nativeEvent.layout.height)}
          style={{
            paddingHorizontal: TAB_BAR_LAYOUT.horizontalPad,
            paddingTop: TAB_BAR_LAYOUT.topPad,
            paddingBottom: Math.max(
              insets.bottom,
              Math.max(insets.bottom, 10) + TAB_BAR_LAYOUT.floatBottom - 8
            ),
          }}
        >
        <View
          ref={capsuleWrapperRef}
          style={{
            borderRadius: COMPOSER_CAPSULE_RADIUS,
            padding: 0,
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderColor: 'transparent',
            overflow: 'visible',
            zIndex: 2,
            elevation: 4,
          }}
        >
          <SafeBlurView
            intensity={Platform.OS === 'ios' ? INPUT_BAR_BLUR_INTENSITY_IOS : INPUT_BAR_BLUR_INTENSITY_ANDROID}
            tint="dark"
            blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
            style={[
              tw`flex-row items-end`,
              {
                minHeight: COMPOSER_LAYOUT.innerHeight,
                borderRadius: COMPOSER_CAPSULE_RADIUS,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: V.border,
                overflow: 'hidden',
                paddingLeft: TAB_BAR_LAYOUT.rowPaddingH,
                paddingRight: 0,
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: V.bgElevated,
                  opacity: INPUT_BAR_FROST_TINT_OPACITY,
                },
              ]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[V.bgApp, 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 10,
                opacity: 0.12,
              }}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', V.bgApp]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 12,
                opacity: 0.1,
              }}
            />
            <SafeBlurView
              pointerEvents="none"
              intensity={Platform.OS === 'ios' ? 42 : 28}
              tint="dark"
              blurReductionFactor={Platform.OS === 'android' ? 4.5 : 3.5}
              style={[
                {
                  position: 'absolute',
                  top: -3,
                  left: -3,
                  right: -3,
                  bottom: -3,
                  borderRadius: COMPOSER_CAPSULE_RADIUS,
                  opacity: 0.32,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: COMPOSER_CAPSULE_RADIUS,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: V.textPrimary,
                  opacity: 0.1,
                },
              ]}
            />
            {ariaUnavailable && ariaTextOnly ? (
              <View
                style={{
                  flex: 1,
                  minHeight: COMPOSER_LAYOUT.innerHeight,
                  justifyContent: 'center',
                  paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  style={[
                    tw`text-[14px] text-center`,
                    { color: V.textMuted, fontWeight: '400' },
                    Platform.OS === 'android' ? { includeFontPadding: false } : null,
                  ]}
                >
                  Aria недоступна. Запусти сервер.
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={toggleEmojiPicker}
                  style={{
                    width: COMPOSER_LAYOUT.innerHeight,
                    height: COMPOSER_LAYOUT.innerHeight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: emojiWobbleRotate.interpolate({
                            inputRange: [-20, 20],
                            outputRange: ['-20deg', '20deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    {showEmojiPicker ? (
                      <KeyboardIcon size={INPUT_BAR_EMOJI_ICON} color={V.textSecondary} strokeWidth={1.5} />
                    ) : (
                      <Smile size={INPUT_BAR_EMOJI_ICON} color={V.textSecondary} strokeWidth={1.5} />
                    )}
                  </Animated.View>
                </TouchableOpacity>

                {text.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      collapseEmojiForKeyboard();
                      setAiPanelOpen(true);
                    }}
                    style={{
                      width: COMPOSER_LAYOUT.innerHeight,
                      height: COMPOSER_LAYOUT.innerHeight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    accessibilityLabel="ИИ-редактор"
                  >
                    <Sparkles size={20} color={V.accentSage} strokeWidth={1.5} />
                  </TouchableOpacity>
                ) : null}

                <TextInput
                  ref={inputRef}
                  style={[
                    tw`flex-1 text-[16px] max-h-24`,
                    {
                      color: V.textPrimary,
                      backgroundColor: 'transparent',
                      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
                      paddingHorizontal: 6,
                      minHeight: COMPOSER_LAYOUT.innerHeight,
                    },
                  ]}
                  placeholder={
                    ephemeralSec
                      ? `Сгорит через ${ephemeralSec}с...`
                      : 'Сообщение...'
                  }
                  placeholderTextColor={V.textGhost}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={sendMessage}
                  onFocus={() => { /* плавное закрытие через useKeyboardHandler.onEnd */ }}
                  returnKeyType="send"
                  multiline
                  editable={!ariaUnavailable}
                />

                {!ariaTextOnly ? (
                  <TouchableOpacity
                    onPress={() => {
                      collapseEmojiForKeyboard();
                      setShowAttachMenu(true);
                    }}
                    style={{
                      marginLeft: INPUT_BAR_CLIP_MIC_SHIFT + 16,
                      width: COMPOSER_LAYOUT.innerHeight - 2,
                      height: COMPOSER_LAYOUT.innerHeight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                  >
                    <Paperclip size={INPUT_BAR_ICON - 2} color={V.textSecondary} strokeWidth={1.5} />
                    {ephemeralSec != null && (
                      <View
                        style={[
                          tw`absolute top-1 right-0.5 w-2 h-2 rounded-full`,
                          { backgroundColor: V.accentGold },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: INPUT_BAR_CLIP_MIC_SHIFT + 16 }} />
                )}

                {text.trim() && !isRecordingVoice ? (
                  <TouchableOpacity
                    onPress={sendMessage}
                    style={{
                      marginLeft: INPUT_BAR_CLIP_MIC_SHIFT,
                      width: MIC_BUTTON_SIZE,
                      height: MIC_BUTTON_SIZE,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel="Отправить"
                  >
                    {/* Как VoiceRecorder: «гнездо» + sage-круг + светлый глиф */}
                    <View
                      style={{
                        width: MIC_BUTTON_SIZE,
                        height: MIC_BUTTON_SIZE,
                        borderRadius: MIC_BUTTON_SIZE / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(13, 15, 20, 0.4)',
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: 'rgba(0, 0, 0, 0.45)',
                      }}
                    >
                      <View
                        style={{
                          width: MIC_INNER,
                          height: MIC_INNER,
                          borderRadius: MIC_INNER / 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: V.accentSage,
                          borderTopWidth: 1,
                          borderLeftWidth: 1,
                          borderBottomWidth: 1,
                          borderRightWidth: 1,
                          borderTopColor: 'rgba(0, 0, 0, 0.32)',
                          borderLeftColor: 'rgba(0, 0, 0, 0.24)',
                          borderBottomColor: 'rgba(255, 255, 255, 0.12)',
                          borderRightColor: 'rgba(255, 255, 255, 0.07)',
                        }}
                      >
                        <Send size={18} color={ON_SAGE_GLYPH} strokeWidth={1.5} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: INPUT_BAR_CLIP_MIC_SHIFT + MIC_BUTTON_SIZE }} />
                )}
              </>
            )}
          </SafeBlurView>

          {uiReady &&
            (!ariaTextOnly || ariaAllowVoice) &&
            !ariaUnavailable &&
            (!text.trim() || isRecordingVoice) && (
            <VoiceRecorder
              onSendAudio={handleSendVoice}
              onRecordingChange={setIsRecordingVoice}
              uploadMedia={uploadMedia}
              sendMediaMessage={sendMediaMessage}
              onOpen={onVoiceRecorderOpen}
              onVideoRecorded={handleVideoRecorded}
              onVideoSendError={handleVideoSendError}
            />
          )}
        </View>
      </View>
      </View>

      {uiReady ? (
        <Reanimated.View
          style={[
            emojiPanelAnimatedStyle,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: V.border,
              backgroundColor: V.bgSurface,
              borderTopLeftRadius: COMPOSER_CAPSULE_RADIUS,
              borderTopRightRadius: COMPOSER_CAPSULE_RADIUS,
              zIndex: 0,
              elevation: 0,
            },
          ]}
        >
            <Reanimated.View style={[emojiContentAnimatedStyle, { flex: 1 }]}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={tw`flex-row flex-wrap p-2`}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                {EMOJI_SET.map((emoji, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => insertEmoji(emoji)}
                    style={{
                      width: '12.5%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={tw`text-2xl`}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Reanimated.View>
        </Reanimated.View>
      ) : null}

      <AiRewritePanel
        visible={aiPanelOpen}
        onRequestClose={() => setAiPanelOpen(false)}
        sourceText={text}
        onApply={(next) => setText(next)}
      />
    </>
  );
}
