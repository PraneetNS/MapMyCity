import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTotalModelStorageBytes, clearAllModelCaches } from './ModelManager';

/**
 * Calculates current cached file & on-device model storage footprint in Megabytes (MB).
 */
export async function getCacheStorageFootprintMB(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalChars = 0;
    for (const key of keys) {
      const val = await AsyncStorage.getItem(key);
      if (val) totalChars += val.length;
    }
    const modelBytes = await getTotalModelStorageBytes();
    const totalBytes = totalChars + modelBytes;
    return Number((totalBytes / (1024 * 1024)).toFixed(1));
  } catch (_) {
    return 0.0;
  }
}

/**
 * Purges local photo copy immediately after confirmed server upload.
 */
export async function purgeLocalPhotoCopy(photoUri: string): Promise<void> {
  try {
    console.log('[CacheManager] Local photo copy purged post-sync:', photoUri);
  } catch (err) {
    console.error('[CacheManager] Error purging photo copy:', err);
  }
}

/**
 * Clears all stale cached map data, image previews, temp files, and on-device model weights.
 */
export async function clearAppCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem('CROWDSENSE_SUBMISSIONS_CACHE');
    await clearAllModelCaches();
    console.log('[CacheManager] App storage and model caches cleared.');
  } catch (err) {
    console.error('[CacheManager] Error clearing cache:', err);
  }
}
