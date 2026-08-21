import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const DATA_SAVER_KEY = 'CROWDSENSE_DATA_SAVER_ENABLED';
const DATA_SAVER_SUGGESTION_SEEN_KEY = 'CROWDSENSE_DATA_SAVER_SUGGESTION_SEEN';

let inMemoryDataSaver = false;

/**
 * Initializes Data Saver preference from local storage.
 */
export async function getOrInitializeDataSaver(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(DATA_SAVER_KEY);
    if (stored !== null) {
      inMemoryDataSaver = stored === 'true';
      return inMemoryDataSaver;
    }
    // Default to false unless user toggles it or accepts suggestion
    inMemoryDataSaver = false;
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Synchronously returns in-memory Data Saver status for fast UI rendering.
 */
export function isDataSaverEnabled(): boolean {
  return inMemoryDataSaver;
}

/**
 * Updates Data Saver state and persists it.
 */
export async function setDataSaverEnabled(enabled: boolean): Promise<void> {
  inMemoryDataSaver = enabled;
  try {
    await AsyncStorage.setItem(DATA_SAVER_KEY, String(enabled));
  } catch (_) {}
}

/**
 * Check whether images/thumbnails should be loaded in low-res mode.
 */
export function shouldUseLowResThumbnails(): boolean {
  return inMemoryDataSaver;
}

/**
 * Checks whether media (e.g. video demos, heavy animations) should autoplay.
 */
export function shouldAutoPlayMedia(): boolean {
  return !inMemoryDataSaver;
}

/**
 * Determines if heavy background sync (offline map downloads, model updates, cache warming)
 * is permitted based on network state and Data Saver policy.
 */
export async function canPerformHeavyBackgroundSync(): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    const isCellular = networkState.type === Network.NetworkStateType.CELLULAR;

    if (inMemoryDataSaver && isCellular) {
      return {
        allowed: false,
        reason: 'Data Saver is active: Deferred heavy sync until Wi-Fi connection.',
      };
    }
    return { allowed: true };
  } catch (_) {
    return { allowed: true };
  }
}

/**
 * Analyzes network type. If the user is on sustained cellular network
 * and hasn't configured Data Saver yet, returns true to prompt auto-suggestion.
 */
export async function shouldSuggestDataSaver(): Promise<boolean> {
  try {
    if (inMemoryDataSaver) return false;
    const seen = await AsyncStorage.getItem(DATA_SAVER_SUGGESTION_SEEN_KEY);
    if (seen === 'true') return false;

    const networkState = await Network.getNetworkStateAsync();
    if (networkState.type === Network.NetworkStateType.CELLULAR) {
      return true;
    }
  } catch (_) {}
  return false;
}

/**
 * Marks that the user has seen or dismissed the Data Saver suggestion.
 */
export async function markDataSaverSuggestionSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(DATA_SAVER_SUGGESTION_SEEN_KEY, 'true');
  } catch (_) {}
}
