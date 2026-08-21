import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';

const LAST_REVIEW_PROMPT_KEY = 'CROWDSENSE_STORE_REVIEW_LAST_SHOWN';
const SESSION_COUNT_KEY = 'CROWDSENSE_APP_SESSION_COUNT';
const MIN_SESSION_THRESHOLD = 3;
const RATE_LIMIT_DAYS = 90; // Prompt at most once every 3 months

/**
 * Tracks app launches to avoid prompting first-time or new users.
 */
export async function incrementAppSessionCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_COUNT_KEY);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    await AsyncStorage.setItem(SESSION_COUNT_KEY, count.toString());
    return count;
  } catch (_) {
    return 1;
  }
}

/**
 * Checks whether the app is eligible to present an in-app store review prompt.
 */
export async function canShowStoreReview(): Promise<boolean> {
  try {
    const sessionRaw = await AsyncStorage.getItem(SESSION_COUNT_KEY);
    const sessionCount = sessionRaw ? parseInt(sessionRaw, 10) : 0;
    if (sessionCount < MIN_SESSION_THRESHOLD) {
      // Never prompt on first 2 sessions
      return false;
    }

    const lastShownRaw = await AsyncStorage.getItem(LAST_REVIEW_PROMPT_KEY);
    if (lastShownRaw) {
      const lastShown = parseInt(lastShownRaw, 10);
      const elapsedDays = (Date.now() - lastShown) / (1000 * 60 * 60 * 24);
      if (elapsedDays < RATE_LIMIT_DAYS) {
        return false; // Throttled within 90-day cooldown window
      }
    }

    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Triggers platform-standard In-App Review at genuine positive civic moments.
 * Reasons:
 * - 'report_resolved': Right after a user's submitted issue is confirmed resolved by municipality
 * - 'impact_milestone': After reaching verified civic milestones (e.g., 5th report, high trust score)
 */
export async function triggerContextualStoreReview(
  reason: 'report_resolved' | 'impact_milestone'
): Promise<boolean> {
  const eligible = await canShowStoreReview();
  if (!eligible) {
    return false;
  }

  try {
    // Record current timestamp to enforce 90-day rate limit
    await AsyncStorage.setItem(LAST_REVIEW_PROMPT_KEY, Date.now().toString());

    // Attempt to invoke standard platform in-app review
    // Fallback gracefully across Expo / web / dev environments
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        // If expo-store-review is installed/available
        const StoreReview = require('expo-store-review');
        if (StoreReview && (await StoreReview.isAvailableAsync())) {
          await StoreReview.requestReview();
          console.log(`[StoreReview] Native review requested successfully (Reason: ${reason})`);
          return true;
        }
      } catch (_) {
        // In Expo Go or mock environment, gracefully fallback without intrusive alerts
        console.log(`[StoreReview] Native module not present, logged review opportunity: ${reason}`);
      }
    }
    return true;
  } catch (err) {
    console.warn('[StoreReview] Failed to present store review:', err);
    return false;
  }
}
