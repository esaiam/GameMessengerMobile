import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Вложение из POST /message (file_base64, file_url, attachment{}, filename, mime_type). */
export function parseAriaMessageAttachment(json) {
  if (!json || typeof json !== 'object') return null;
  const nested =
    json.attachment && typeof json.attachment === 'object' ? json.attachment : null;
  const b64Raw = json.file_base64 ?? nested?.data_base64;
  const b64 = typeof b64Raw === 'string' && b64Raw.trim() ? b64Raw.trim() : null;
  const urlRaw = json.file_url ?? nested?.url;
  const file_url = typeof urlRaw === 'string' && urlRaw.trim() ? urlRaw.trim() : null;
  if (!b64 && !file_url) return null;

  const mime =
    (typeof json.mime_type === 'string' && json.mime_type.trim()) ||
    (typeof nested?.mime_type === 'string' && nested.mime_type.trim()) ||
    'application/octet-stream';

  return {
    ...(b64 ? { file_base64: b64 } : {}),
    ...(file_url ? { file_url } : {}),
    filename:
      (typeof json.filename === 'string' && json.filename.trim()) ||
      (typeof nested?.filename === 'string' && nested.filename.trim()) ||
      'file',
    mime_type: mime,
    size_bytes: Number.isFinite(Number(json.size_bytes))
      ? Number(json.size_bytes)
      : Number.isFinite(Number(nested?.size_bytes))
        ? Number(nested.size_bytes)
        : undefined };
}

/** URI для превью картинки в чате (PNG/JPEG/WebP — URL или data:). */
export function ariaAttachmentImageUri(attachment) {
  if (!attachment) return null;
  const mime = String(attachment.mime_type || '');
  if (!mime.startsWith('image/')) return null;
  if (attachment.file_url) return attachment.file_url;
  if (attachment.file_base64) {
    return `data:${mime};base64,${attachment.file_base64}`;
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
