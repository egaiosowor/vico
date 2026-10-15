import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import {
  MAX_MEDIA_SIZE_BYTES,
  IMAGE_COMPRESSION_QUALITY,
  IMAGE_MAX_DIMENSION,
} from '../config/constants';

export interface CompressedMediaResult {
  compressedUri: string;
  sizeBytes: number;
  mimeType: string;
}

const getFileSize = async (uri: string): Promise<number> => {
  try {
    const file = new File(uri);
    if (file.exists) {
      return file.size;
    }
  } catch {
    // Fallback to legacy API if File constructor has issues with specific URI schemes
  }

  try {
    const fileInfo = await FileSystemLegacy.getInfoAsync(uri);
    if (fileInfo.exists) {
      return fileInfo.size || 0;
    }
  } catch {
    // If metadata retrieval fails, return 0
  }

  return 0;
};

export const compressImage = async (uri: string): Promise<CompressedMediaResult> => {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: IMAGE_MAX_DIMENSION } }],
    { compress: IMAGE_COMPRESSION_QUALITY, format: SaveFormat.JPEG }
  );

  const size = await getFileSize(result.uri);

  if (size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error('Image size exceeds 50MB limit even after compression.');
  }

  return {
    compressedUri: result.uri,
    sizeBytes: size,
    mimeType: 'image/jpeg',
  };
};

export const validateVideo = async (uri: string): Promise<CompressedMediaResult> => {
  const size = await getFileSize(uri);

  if (size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error('Video size exceeds maximum allowed 50MB limit.');
  }

  return {
    compressedUri: uri,
    sizeBytes: size,
    mimeType: 'video/mp4',
  };
};
