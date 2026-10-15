import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@env';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { MediaType } from '../types';

export const uploadToCloudinary = async (
  localUri: string,
  mediaType: MediaType,
  incidentId: string
): Promise<string> => {
  const cloudName = CLOUDINARY_CLOUD_NAME || 'demo';
  const uploadPreset = CLOUDINARY_UPLOAD_PRESET || 'nightwatch_preset';

  // If using placeholder in development, return localUri for instant offline testing
  if (cloudName === 'demo' || cloudName === 'your_cloudinary_cloud_name') {
    console.log('[Cloudinary] Running with placeholder cloud name. Using local URI as media URL.');
    return localUri;
  }

  const resourceType = mediaType === 'video' ? 'video' : 'image';
  const mime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  try {
    // Native multipart upload using expo-file-system to prevent React Native FormDataPart errors
    const uploadResult = await FileSystemLegacy.uploadAsync(uploadUrl, localUri, {
      httpMethod: 'POST',
      uploadType: FileSystemLegacy.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mime,
      parameters: {
        upload_preset: uploadPreset,
        folder: 'nightwatch_incidents',
        public_id: `incident_${incidentId}`,
      },
    });

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new Error(`Cloudinary error (${uploadResult.status}): ${uploadResult.body}`);
    }

    const data = JSON.parse(uploadResult.body);
    if (!data.secure_url) {
      throw new Error('Cloudinary did not return a secure URL');
    }

    return data.secure_url;
  } catch (error: any) {
    console.warn('[Cloudinary] uploadAsync failed:', error);
    throw error;
  }
};
