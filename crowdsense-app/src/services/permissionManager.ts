/**
 * permissionManager.ts
 * 
 * Just-In-Time Device Resource Permission Manager.
 * 
 * Principles:
 * 1. Just-In-Time: Never requests permissions upfront at launch.
 * 2. Pre-Prompt Justification: Explains the exact reason before the OS dialog triggers.
 * 3. Graceful Fallback: Every gated feature has a zero-permission alternative path.
 * 4. Settings Recovery: Direct deep-linking via Linking.openSettings() when blocked.
 * 5. Minimal Scope: Strictly foreground location, narrow photo picker, on-device audio.
 */

import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export type ResourcePermissionType = 
  | 'camera'
  | 'photo_library'
  | 'location_foreground'
  | 'microphone';

export type PermissionStatusResult = 
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'blocked';

export interface PermissionRationale {
  title: string;
  description: string;
  fallbackDescription: string;
  iconName: string;
}

export const PERMISSION_RATIONALES: Record<ResourcePermissionType, PermissionRationale> = {
  camera: {
    title: 'Camera Access Needed',
    description: 'CrowdSense uses your camera to capture high-clarity photos of road hazards, potholes, and civic issues.',
    fallbackDescription: 'You can choose an existing photo from your gallery instead.',
    iconName: 'camera',
  },
  photo_library: {
    title: 'Photo Library Access',
    description: 'Allows you to select previously captured photos of civic infrastructure issues to attach to your report.',
    fallbackDescription: 'You can take a live photo with the camera or submit a text-only report.',
    iconName: 'image',
  },
  location_foreground: {
    title: 'Location Access (While in Use)',
    description: 'Used to automatically pin the precise GPS coordinates of civic hazards and show nearby alerts in your ward.',
    fallbackDescription: 'You can manually drag and position a pin on the map.',
    iconName: 'map-pin',
  },
  microphone: {
    title: 'Microphone for Voice Input',
    description: 'Allows you to speak your issue description. Audio is processed 100% on-device and raw sound is never uploaded.',
    fallbackDescription: 'You can type your issue notes or pick categories manually.',
    iconName: 'mic',
  },
};

/**
 * Checks current permission status without prompting the user.
 */
export async function checkPermissionStatus(
  type: ResourcePermissionType
): Promise<PermissionStatusResult> {
  try {
    switch (type) {
      case 'camera': {
        const { status, canAskAgain } = await Camera.getCameraPermissionsAsync();
        if (status === 'granted') return 'granted';
        if (!canAskAgain && status === 'denied') return 'blocked';
        return status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'photo_library': {
        const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (status === 'granted') return 'granted';
        if (!canAskAgain && status === 'denied') return 'blocked';
        return status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'location_foreground': {
        const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') return 'granted';
        if (!canAskAgain && status === 'denied') return 'blocked';
        return status === 'denied' ? 'denied' : 'undetermined';
      }
      case 'microphone': {
        const { status, canAskAgain } = await Audio.getPermissionsAsync();
        if (status === 'granted') return 'granted';
        if (!canAskAgain && status === 'denied') return 'blocked';
        return status === 'denied' ? 'denied' : 'undetermined';
      }
    }
  } catch (err) {
    console.warn(`[PermissionManager] Error checking ${type}:`, err);
    return 'undetermined';
  }
}

/**
 * Requests native operating system permission directly.
 */
export async function requestNativePermission(
  type: ResourcePermissionType
): Promise<PermissionStatusResult> {
  try {
    switch (type) {
      case 'camera': {
        const res = await Camera.requestCameraPermissionsAsync();
        if (res.granted) return 'granted';
        return !res.canAskAgain ? 'blocked' : 'denied';
      }
      case 'photo_library': {
        const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (res.granted) return 'granted';
        return !res.canAskAgain ? 'blocked' : 'denied';
      }
      case 'location_foreground': {
        const res = await Location.requestForegroundPermissionsAsync();
        if (res.granted) return 'granted';
        return !res.canAskAgain ? 'blocked' : 'denied';
      }
      case 'microphone': {
        const res = await Audio.requestPermissionsAsync();
        if (res.granted) return 'granted';
        return !res.canAskAgain ? 'blocked' : 'denied';
      }
    }
  } catch (err) {
    console.warn(`[PermissionManager] Error requesting ${type}:`, err);
    return 'denied';
  }
}

/**
 * Opens system application settings for recovery from 'blocked' state.
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    console.warn('[PermissionManager] Could not open app settings:', err);
  }
}
