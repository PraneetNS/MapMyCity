import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export interface CivicSurveyPayload {
  userId?: string;
  clusterId?: string;
  wardId: string;
  category: string;
  rating: number; // 1-5
  aspects: string[];
  feedbackText?: string;
  resolutionSpeedRating?: number;
  workmanshipRating?: number;
}

const OFFLINE_SURVEY_QUEUE_KEY = '@crowdsense_offline_surveys';

export async function submitCivicSurvey(payload: CivicSurveyPayload): Promise<{ success: boolean; offline: boolean; data?: any }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/surveys/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, offline: false, data };
    }
  } catch (error) {
    console.warn('Network unavailable, queuing civic survey offline:', error);
  }

  // Queue locally if offline or network error
  try {
    const existingQueue = await AsyncStorage.getItem(OFFLINE_SURVEY_QUEUE_KEY);
    const queue: CivicSurveyPayload[] = existingQueue ? JSON.parse(existingQueue) : [];
    queue.push(payload);
    await AsyncStorage.setItem(OFFLINE_SURVEY_QUEUE_KEY, JSON.stringify(queue));
    return { success: true, offline: true };
  } catch (queueErr) {
    console.error('Failed to store survey offline:', queueErr);
    return { success: false, offline: true };
  }
}

export async function flushOfflineSurveys(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_SURVEY_QUEUE_KEY);
    if (!raw) return 0;

    const queue: CivicSurveyPayload[] = JSON.parse(raw);
    if (queue.length === 0) return 0;

    const remaining: CivicSurveyPayload[] = [];
    let synced = 0;

    for (const item of queue) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/surveys/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (res.ok) {
          synced++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(OFFLINE_SURVEY_QUEUE_KEY, JSON.stringify(remaining));
    return synced;
  } catch {
    return 0;
  }
}
