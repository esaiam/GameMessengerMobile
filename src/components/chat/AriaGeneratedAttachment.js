import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { V } from '../../theme';
import { FileText } from '../../icons/lucideIcons';
import ChatImageMessage from './ChatImageMessage';
import {
  ariaAttachmentImageUri,
  formatAriaAttachmentSize,
  saveAndOpenAriaPdfAttachment,
  alertAriaPdfOpenError } from '../../lib/ariaAttachment';

/**
 * Вложение Aria под текстовым пузырём: PNG-превью или карточка PDF.
 */
export default function AriaGeneratedAttachment({
  attachment,
  layoutMaxWidth,
  formattedTime,
  isRead,
  isMine = false,
  onImagePress }) {
  const [pdfBusy, setPdfBusy] = useState(false);

  const imageUri = ariaAttachmentImageUri(attachment);
  if (imageUri) {
    return (
      <ChatImageMessage
        uri={imageUri}
        caption=""
        formattedTime={formattedTime}
        isRead={isRead}
        isMine={isMine}
        fillWidth
        layoutMaxWidth={layoutMaxWidth}
        isEphemeral={false}
        expiresAt={null}
        isSelected={false}
        onPress={() => onImagePress?.(imageUri)}
      />
    );
  }

  if (attachment?.mime_type !== 'application/pdf') return null;

  const sizeLabel = formatAriaAttachmentSize(attachment.size_bytes);
  const label = `Скачать PDF: ${attachment.filename || 'document.pdf'}`;

  const onPdfPress = useCallback(async () => {
    setPdfBusy(true);
    try {
      await saveAndOpenAriaPdfAttachment(attachment);
    } catch {
      alertAriaPdfOpenError();
    } finally {
      setPdfBusy(false);
    }
  }, [attachment]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPdfPress}
      disabled={pdfBusy}
      style={[styles.pdfCard, { maxWidth: layoutMaxWidth }]}
    >
      <View style={styles.pdfIconWrap}>
        {pdfBusy ? (
          <ActivityIndicator color={V.accentSage} size="small" />
        ) : (
          <FileText size={20} color={V.accentGold} strokeWidth={1.5} />
        )}
      </View>
      <View style={styles.pdfTextWrap}>
        <Text style={styles.pdfTitle} numberOfLines={2}>
          {label}
        </Text>
        {sizeLabel ? (
          <Text style={styles.pdfSize}>{sizeLabel}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V.border,
    backgroundColor: V.bgElevated },
  pdfIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.gameBubbleBg },
  pdfTextWrap: {
    flex: 1,
    minWidth: 0 },
  pdfTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: V.textPrimary,
    lineHeight: 18
  },
  pdfSize: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '400',
    color: V.textSecondary
  } });
