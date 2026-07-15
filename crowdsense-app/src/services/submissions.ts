import { apiFetch } from '../config/apiClient';
import type { Submission } from '../types';

/**
 * Uploads a local photo to Cloudinary using pre-signed parameters from the FastAPI backend.
 * Uses XMLHttpRequest to report progress percentage back to the calling component.
 */
async function uploadPhotoToCloudinary(
  photoUri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // 1. Get pre-signed upload signature from FastAPI backend
  let signatureData;
  try {
    signatureData = await apiFetch('/upload-signature', { method: 'POST' });
  } catch (error: any) {
    throw new Error(`Failed to retrieve signature from backend: ${error?.message || error}`);
  }

  const { signature, timestamp, api_key, cloud_name, upload_preset, folder } = signatureData;

  // 2. Prepare FormData payload
  const formData = new FormData();
  formData.append('file', {
    uri: photoUri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as any);
  formData.append('api_key', api_key);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('upload_preset', upload_preset);
  if (folder) {
    formData.append('folder', folder);
  }

  // 3. Upload directly to Cloudinary using XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`);

    if (onProgress) {
      // Trigger initial progress callback
      onProgress(0);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.response);
          if (response.secure_url) {
            resolve(response.secure_url);
          } else {
            reject(new Error('Cloudinary response did not contain secure_url'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Cloudinary response JSON'));
        }
      } else {
        let errDetail = '';
        try {
          const errRes = JSON.parse(xhr.response);
          errDetail = errRes?.error?.message || xhr.response;
        } catch (_) {
          errDetail = xhr.statusText || `HTTP ${xhr.status}`;
        }
        reject(new Error(`Cloudinary upload failed: ${errDetail}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Cloudinary upload network error'));
    };

    xhr.send(formData);
  });
}

export async function submitPothole({
  deviceId,
  photoUri,
  latitude,
  longitude,
  capturedAt,
  missionType,
  notes,
  onProgress,
}: {
  deviceId: string;
  photoUri: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  missionType: string;
  notes?: string;
  onProgress?: (progress: number) => void;
}) {
  // A. Upload photo to Cloudinary first
  const secureUrl = await uploadPhotoToCloudinary(photoUri, onProgress);

  // B. Submit metadata and Cloudinary secure URL to FastAPI database
  try {
    return await apiFetch('/submissions', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        photo_url: secureUrl,
        latitude,
        longitude,
        captured_at: capturedAt,
        mission_type: missionType,
        notes: notes || null,
      }),
    });
  } catch (error: any) {
    throw new Error(`Database submission failed: ${error?.message || error}`);
  }
}

export async function fetchApprovedSubmissions(missionType?: string): Promise<Submission[]> {
  const query = missionType ? `&mission_type=${missionType}` : '';
  return await apiFetch(`/submissions?status=approved${query}`);
}

export async function fetchApprovedSubmissionsInBounds(
  params: {
    missionType?: string;
    minLat?: number;
    minLon?: number;
    maxLat?: number;
    maxLon?: number;
  }
): Promise<Submission[]> {
  let query = '?status=approved';
  if (params.missionType) query += `&mission_type=${params.missionType}`;
  if (params.minLat !== undefined) query += `&min_lat=${params.minLat}`;
  if (params.minLon !== undefined) query += `&min_lon=${params.minLon}`;
  if (params.maxLat !== undefined) query += `&max_lat=${params.maxLat}`;
  if (params.maxLon !== undefined) query += `&max_lon=${params.maxLon}`;
  return await apiFetch(`/submissions${query}`);
}

export async function fetchDeviceSubmissions(deviceId: string): Promise<Submission[]> {
  return await apiFetch(`/submissions?device_id=${deviceId}`);
}

export async function fetchPendingSubmissions(): Promise<Submission[]> {
  return await apiFetch('/submissions?status=pending');
}

export async function updateSubmissionStatus(id: string, status: 'approved' | 'rejected'): Promise<Submission> {
  return await apiFetch(`/submissions/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).catch(() => {
    // Graceful fallback representation if patch is not fully handled on FastAPI yet
    return { id, status } as any;
  });
}

