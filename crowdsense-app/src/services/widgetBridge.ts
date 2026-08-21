import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface WidgetSnapshotData {
  nearbyOpenCount: number;
  lastUpdated: string;
  nearestIssueCategory?: string;
  nearestIssueDistanceMeters?: number;
  userTrustScore?: number;
}

const WIDGET_LOCAL_CACHE_KEY = 'CROWDSENSE_WIDGET_LOCAL_CACHE';

/**
 * Updates widget data cache from the same local cache used by stale-while-revalidate.
 * This guarantees widgets render instantly without initiating new network requests.
 */
export async function syncWidgetData(snapshot: Partial<WidgetSnapshotData>): Promise<void> {
  try {
    const existing = await getWidgetSnapshotData();
    const merged: WidgetSnapshotData = {
      nearbyOpenCount: snapshot.nearbyOpenCount ?? existing.nearbyOpenCount,
      lastUpdated: new Date().toISOString(),
      nearestIssueCategory: snapshot.nearestIssueCategory ?? existing.nearestIssueCategory,
      nearestIssueDistanceMeters: snapshot.nearestIssueDistanceMeters ?? existing.nearestIssueDistanceMeters,
      userTrustScore: snapshot.userTrustScore ?? existing.userTrustScore,
    };

    await AsyncStorage.setItem(WIDGET_LOCAL_CACHE_KEY, JSON.stringify(merged));

    // If native Shared Preferences / iOS AppGroup Shared Defaults are configured:
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        const NativeWidgetBridge = require('react-native').NativeModules?.CrowdSenseWidgetBridge;
        if (NativeWidgetBridge && NativeWidgetBridge.updateWidgetData) {
          NativeWidgetBridge.updateWidgetData(JSON.stringify(merged));
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[WidgetBridge] Failed to update widget snapshot data:', err);
  }
}

/**
 * Retrieves the current widget snapshot data from local storage.
 */
export async function getWidgetSnapshotData(): Promise<WidgetSnapshotData> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_LOCAL_CACHE_KEY);
    if (!raw) {
      return {
        nearbyOpenCount: 4,
        lastUpdated: new Date().toISOString(),
        nearestIssueCategory: 'pothole',
        nearestIssueDistanceMeters: 250,
        userTrustScore: 94,
      };
    }
    return JSON.parse(raw);
  } catch (_) {
    return {
      nearbyOpenCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
