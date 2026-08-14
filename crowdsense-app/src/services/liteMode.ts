import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LITE_MODE_KEY = 'CROWDSENSE_LITE_MODE_ENABLED';
const LITE_MODE_AUTO_CHECKED = 'CROWDSENSE_LITE_MODE_AUTO_CHECKED';

export interface LiteModeSettings {
  isLiteMode: boolean;
  autoDetected: boolean;
}

/**
 * Detects whether the device is low-spec (Android Go / older OS / low RAM).
 */
export async function detectLowSpecDevice(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version < 28) {
      return true; // Auto-enable Lite Mode on older Android versions
    }
  } catch (_) {}
  return false;
}

/**
 * Initializes Lite Mode on app launch (auto-defaults low-spec phones into Lite Mode).
 */
export async function getOrInitializeLiteMode(): Promise<boolean> {
  try {
    const storedVal = await AsyncStorage.getItem(LITE_MODE_KEY);
    if (storedVal !== null) {
      return storedVal === 'true';
    }

    const isLowSpec = await detectLowSpecDevice();
    await AsyncStorage.setItem(LITE_MODE_KEY, String(isLowSpec));
    await AsyncStorage.setItem(LITE_MODE_AUTO_CHECKED, 'true');
    return isLowSpec;
  } catch (_) {
    return false;
  }
}

let inMemoryLiteMode = false;

export function isLiteModeEnabled(): boolean {
  return inMemoryLiteMode;
}

export async function setLiteModeEnabled(enabled: boolean): Promise<void> {
  inMemoryLiteMode = enabled;
  try {
    await AsyncStorage.setItem(LITE_MODE_KEY, String(enabled));
  } catch (_) {}
}
