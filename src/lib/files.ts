/**
 * Files on the phone: taking a photo, choosing one, picking a document,
 * shrinking images before upload, and opening or sharing a downloaded PDF.
 *
 * Limits are said before the person picks (`describeLimits`) and checked
 * after, so a 25 MB scan is refused with a reason rather than failing halfway
 * through a slow upload.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { describeError } from '../components/States';
import { toast } from '../components/Toast';
import { downloadFile, type UploadFile } from './api';
import { t } from './i18n';

export interface FileRules {
  /**
   * Largest file accepted, in megabytes. Left out, the workspace's upload limit
   * (an admin sets it in the portal: Settings → Company → Workspace).
   */
  maxMb?: number;
  /** MIME types accepted, e.g. ['image/*', 'application/pdf']. */
  types: string[];
}

export const DEFAULT_RULES: FileRules = { types: ['image/*', 'application/pdf'] };

/** Until the session says otherwise. */
let workspaceMaxMb = 10;

/** The workspace's upload limit, from the session (`tenant.max_upload_mb`). */
export function setUploadLimit(mb: number | null | undefined): void {
  if (typeof mb === 'number' && mb > 0) workspaceMaxMb = mb;
}

/** The limit these rules come to: their own, or the workspace's. */
export function limitMb(rules: FileRules): number {
  return rules.maxMb ?? workspaceMaxMb;
}

export function describeLimits(rules: FileRules): string {
  const kinds = rules.types
    .map((type) =>
      type === 'image/*' ? 'photos (JPG, PNG)' : type === 'application/pdf' ? 'PDF' : (type.split('/')[1] ?? type).toUpperCase(),
    )
    .join(', ');
  const text = t('{kinds}, up to {mb} MB', { kinds, mb: limitMb(rules) });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function accepts(rules: FileRules, mime: string): boolean {
  return rules.types.some((type) => (type.endsWith('/*') ? mime.startsWith(type.slice(0, -1)) : mime === type));
}

async function sizeOf(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info ? (info.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/** Shrink a photo to a sensible size before it goes over a slow connection. */
async function compress(uri: string): Promise<{ uri: string; mime: string }> {
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: result.uri, mime: 'image/jpeg' };
  } catch {
    return { uri, mime: 'image/jpeg' };
  }
}

async function check(file: UploadFile, rules: FileRules): Promise<UploadFile | null> {
  if (!accepts(rules, file.type)) {
    toast.error(t('That file type is not accepted here. Use {limits}.', { limits: describeLimits(rules) }));
    return null;
  }
  const bytes = await sizeOf(file.uri);
  const max = limitMb(rules);
  if (bytes > max * 1024 * 1024) {
    toast.error(t('That file is {mb} MB. The limit is {max} MB.', { mb: (bytes / 1024 / 1024).toFixed(1), max }));
    return null;
  }
  return file;
}

export async function takePhoto(rules: FileRules = DEFAULT_RULES, options: { front?: boolean } = {}): Promise<UploadFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    toast.error(t('Allow camera access in your phone settings to take a photo.'));
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    cameraType: options.front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
  });
  if (result.canceled || !result.assets[0]) return null;
  const small = await compress(result.assets[0].uri);
  return check({ uri: small.uri, name: `photo-${Date.now()}.jpg`, type: small.mime }, rules);
}

export async function choosePhoto(rules: FileRules = DEFAULT_RULES): Promise<UploadFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  const small = await compress(result.assets[0].uri);
  // Keep the photo's own name (now a JPEG), so HR sees "receipt.jpg", not a number.
  const original = result.assets[0].fileName?.replace(/\.\w+$/, '');
  return check({ uri: small.uri, name: `${original || `photo-${Date.now()}`}.jpg`, type: small.mime }, rules);
}

export async function chooseDocument(rules: FileRules = DEFAULT_RULES): Promise<UploadFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: rules.types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  let file: UploadFile = { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' };
  if (file.type.startsWith('image/')) {
    const small = await compress(file.uri);
    file = { ...file, uri: small.uri, type: small.mime, name: file.name.replace(/\.\w+$/, '') + '.jpg' };
  }
  return check(file, rules);
}

/** Read a photo as a data URL (for a punch selfie, which the API takes inline). */
export async function asDataUrl(file: UploadFile): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${file.type};base64,${base64}`;
}

export async function shareFile(uri: string, mime = 'application/pdf'): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    toast.error(t('Sharing is not available on this phone.'));
    return;
  }
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: t('Share') });
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/zip': '.zip',
};

/** "PAN card" + PDF -> "PAN card.pdf": viewers and share targets go by the extension. */
export function withExtension(name: string, mime: string | null | undefined): string {
  if (!mime || /\.[a-z0-9]{2,5}$/i.test(name)) return name;
  return name + (EXTENSIONS[mime] ?? '');
}

/** Download, giving the cached file the right extension once the type is known. */
async function fetchToCache(path: string, filename: string, knownMime?: string): Promise<{ uri: string; mime: string }> {
  const { uri, mime: sent } = await downloadFile(path, withExtension(filename, knownMime));
  const mime = knownMime ?? sent ?? 'application/pdf';
  const named = withExtension(uri, mime);
  if (named === uri) return { uri, mime };
  await FileSystem.moveAsync({ from: uri, to: named }).catch(() => {});
  return { uri: (await FileSystem.getInfoAsync(named)).exists ? named : uri, mime };
}

/**
 * Download a file from the API and open it in the phone's viewer (or the share sheet).
 * Without a `mime`, the type the server sent is used.
 */
export async function openDownloaded(path: string, filename: string, knownMime?: string): Promise<boolean> {
  try {
    const { uri, mime } = await fetchToCache(path, filename, knownMime);
    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: contentUri, flags: 1, type: mime });
        return true;
      } catch {
        // No viewer installed: fall through to sharing.
      }
    }
    await shareFile(uri, mime);
    return true;
  } catch (error) {
    toast.error(describeError(error).message);
    return false;
  }
}

/** Download, then share (WhatsApp, email, Drive…). */
export async function shareDownloaded(path: string, filename: string, knownMime = 'application/pdf'): Promise<boolean> {
  try {
    const { uri, mime } = await fetchToCache(path, filename, knownMime);
    await shareFile(uri, mime);
    return true;
  } catch (error) {
    toast.error(describeError(error).message);
    return false;
  }
}
