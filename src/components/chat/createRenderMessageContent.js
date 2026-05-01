import React from 'react';
import { View, TouchableOpacity, Image, Text, Linking } from 'react-native';
import tw from 'twrnc';
import { MapPin } from '../../icons/lucideIcons';
import { V } from '../../theme';
import ChatVoicePlayer from './ChatVoicePlayer';
import VideoMessage from './VideoMessage';
import { MSG_TEXT_SIZE, MSG_LINE_HEIGHT } from './messageBubbleLayoutConstants';
import { parseVoiceCaptionDurationSec } from './chatMessageListFormat';

/**
 * Фабрика рендера тела пузыря (медиа/текст внутри MessageRow). Замыкания — только переданные deps.
 */
export function createRenderMessageContent({
  setFullScreenImage,
  isRecordingVoice,
  setActiveVoiceMessageId,
  handleVoicePlay,
  activeVoiceMessageId,
  activePlayerStatus,
  activeVideoId,
  setActiveVideoId,
  activatedVideoIdsRef,
  rowEnvRef,
}) {
  return function renderMessageContent(item, isMine) {
    const type = item.message_type || 'text';
    const bodyColor = V.textPrimary;
    const titleLocStyle = {
      fontSize: MSG_TEXT_SIZE,
      fontWeight: '500',
      lineHeight: MSG_LINE_HEIGHT,
      color: bodyColor,
    };
    const bodyTextStyle = {
      fontSize: MSG_TEXT_SIZE,
      fontWeight: '400',
      lineHeight: MSG_LINE_HEIGHT,
      color: bodyColor,
    };
    switch (type) {
      case 'image':
        return (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFullScreenImage(item.media_url)}>
            <Image
              source={{ uri: item.media_url }}
              style={tw`w-52 h-52 rounded-[12px]`}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      case 'voice':
      case 'audio':
        return (
          <ChatVoicePlayer
            url={item.media_url}
            messageId={item.id}
            isRecordingVoice={isRecordingVoice}
            waveformRaw={item.waveform}
            onPlay={(uri) => {
              setActiveVoiceMessageId(item.id);
              handleVoicePlay(uri);
            }}
            activeVoiceMessageId={activeVoiceMessageId}
            activePlayerStatus={activePlayerStatus}
            idleDurationSec={parseVoiceCaptionDurationSec(item.text)}
          />
        );
      case 'location':
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps?q=${item.latitude},${item.longitude}`
              )
            }
            style={tw`flex-row items-center`}
          >
            <MapPin size={20} color={V.accentSage} strokeWidth={1.5} style={tw`mr-2`} />
            <View style={tw`flex-shrink`}>
              <Text style={titleLocStyle}>Местоположение</Text>
              <Text style={[tw`text-[10px]`, { color: V.textSecondary }]}>
                {item.latitude?.toFixed(5)}, {item.longitude?.toFixed(5)}
              </Text>
              <Text style={[tw`text-[10px] mt-0.5`, { color: V.accentSage }]}>
                Открыть в картах →
              </Text>
            </View>
          </TouchableOpacity>
        );
      case 'video':
        return (
          <VideoMessage
            url={item.media_url}
            messageId={item.id}
            activeVideoId={activeVideoId}
            wasActivated={activatedVideoIdsRef.current.has(item.id)}
            onActivate={(id) => {
              if (id) activatedVideoIdsRef.current.add(id);
              setActiveVideoId(id);
            }}
            onLongPress={(e) => {
              const x = e?.nativeEvent?.pageX ?? 0;
              const y = e?.nativeEvent?.pageY ?? 0;
              rowEnvRef.current.handleMessageLongPress({ nativeEvent: { pageX: x, pageY: y } }, item);
            }}
          />
        );
      default:
        return (
          <Text style={bodyTextStyle}>
            {item.text}
          </Text>
        );
    }
  };
}
