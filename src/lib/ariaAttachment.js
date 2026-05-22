import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Вложение из POST /message (file_base64, filename, mime_type, size_bytes). */
export function parseAriaMessageAttachment(json) {
  if (!json || typeof json !== 'object') return null;
  const b64 = json.file_base64;
  if (typeof b64 !== 'string' || !b64.trim()) return null;
  return {
    file_base64: b64.trim(),
    filename:
      typeof json.filename === 'string' && json.filename.trim()
        ? json.filename.trim()
        : 'file',
    mime_type:
      typeof json.mime_type === 'string' && json.mime_type.trim()
        ? json.mime_type.trim()
        : 'application/octet-stream',
    size_bytes: Number.isFinite(Number(json.size_bytes))
      ? Number(json.size_bytes)
      : undefined };
}

/** data: URI для превью PNG в чате. */
export function ariaAttachmentImageUri(attachment) {
  if (!attachment?.file_base64) return null;
  if (attachment.mime_type === 'image/png') {
    return `data:image/png;base64,${attachment.file_base64}`;
  }
  return null;
}

function sanitizeFilename(name) {
  const base = String(name || 'file')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim();
  return base.slice(0, 120) || 'file';
}

export function formatAriaAttachmentSize(sizeBytes) {
  const n = Number(sizeBytes);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Сохранить PDF в cache и открыть системным просмотрщиком (без expo-sharing).
 * @param {{ file_base64: string, filename: string }} attachment
 */
export async function saveAndOpenAriaPdfAttachment(attachment) {
  const filename = sanitizeFilename(attachment.filename);
  const base64 = attachment.file_base64;
  if (!base64) throw new Error('empty_file');

  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof atob !== 'function') {
      throw new Error('web_unavailable');
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('no_cache');

  const path = `${dir}${filename.endsWith('.pdf') ? filename : `${filename}.pdf`}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64 });

  let openUri = path;
  if (Platform.OS === 'android') {
    openUri = await FileSystem.getContentUriAsync(path);
  }

  const canOpen = await Linking.canOpenURL(openUri);
  if (!canOpen) throw new Error('cannot_open');
  await Linking.openURL(openUri);
}

export function alertAriaPdfOpenError() {
  Alert.alert('Не удалось открыть PDF', 'Попробуйте ещё раз или сохраните файл вручную.');
}
