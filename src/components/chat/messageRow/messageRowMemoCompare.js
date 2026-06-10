/**
 * Custom React.memo comparator for FlatList MessageRow rows.
 *
 * Voice/audio rows: only the active row (or row becoming active) should re-render
 * on voicePlaybackSig / activeVoiceUri / isRecordingVoice. Inactive voice rows still
 * re-render when activeVoiceUri or activeVoiceMessageId changes to clear stuck progress.
 *
 * Video rows: re-render only when this row's activeVideoId state toggles.
 *
 * All other rows: skip re-render when item, index, and listExtra reference are stable.
 */
export function messageRowPropsAreEqual(prev, next) {
  const isVoiceOrAudio = (item) =>
    item?.message_type === 'voice' ||
    item?.message_type === 'audio' ||
    (item?.aria_voice_message === true && !!item?.audio_uri);

  if (isVoiceOrAudio(prev.item)) {
    const prevIsActive = prev.activeVoiceMessageId === prev.item.id;
    const nextIsActive = next.activeVoiceMessageId === next.item.id;
    // Если этот пузырь сейчас активен или становится активным — перерендер
    if (prevIsActive || nextIsActive) {
      return (
        prev.voicePlaybackSig === next.voicePlaybackSig &&
        prev.activeVoiceUri === next.activeVoiceUri &&
        prev.isRecordingVoice === next.isRecordingVoice
      );
    }
    // Неактивная голосовая строка: item стабилен, но смена URI/id плеера должна снимать залипший прогресс
    return (
      prev.item === next.item &&
      prev.index === next.index &&
      prev.listExtra === next.listExtra &&
      prev.activeVoiceUri === next.activeVoiceUri &&
      prev.activeVoiceMessageId === next.activeVoiceMessageId
    );
  }

  if (prev.item.message_type === 'video') {
    const prevIsActive = prev.activeVideoId === prev.item.id;
    const nextIsActive = next.activeVideoId === next.item.id;
    // Перерендер только если этот конкретный пузырь стал активным или перестал
    if (prevIsActive !== nextIsActive) return false;
  }

  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.listExtra === next.listExtra
  );
}
