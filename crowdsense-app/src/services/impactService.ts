import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CitizenImpactScore {
  totalReports: number;
  resolvedReports: number;
  upvotesReceived: number;
  streakWeeks: number;
  civicPoints: number;
  tier: 'Civic Scout' | 'Ward Guardian' | 'City Champion' | 'Urban Hero';
  nextTierPoints: number;
  progressPercent: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  wardName: string;
  resolvedCount: number;
}

const IMPACT_CACHE_KEY = 'mapmycity.citizen_impact_cache';

export function calculateCitizenTier(points: number): {
  tier: CitizenImpactScore['tier'];
  nextTierPoints: number;
  progressPercent: number;
} {
  if (points < 100) {
    return {
      tier: 'Civic Scout',
      nextTierPoints: 100,
      progressPercent: Math.min(100, Math.round((points / 100) * 100)),
    };
  } else if (points < 300) {
    return {
      tier: 'Ward Guardian',
      nextTierPoints: 300,
      progressPercent: Math.min(100, Math.round(((points - 100) / 200) * 100)),
    };
  } else if (points < 750) {
    return {
      tier: 'City Champion',
      nextTierPoints: 750,
      progressPercent: Math.min(100, Math.round(((points - 300) / 450) * 100)),
    };
  } else {
    return {
      tier: 'Urban Hero',
      nextTierPoints: 1500,
      progressPercent: Math.min(100, Math.round(((points - 750) / 750) * 100)),
    };
  }
}

export async function getCachedCitizenImpact(): Promise<CitizenImpactScore> {
  try {
    const raw = await AsyncStorage.getItem(IMPACT_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read impact cache:', e);
  }

  // Default initial score
  const initialPoints = 25;
  const { tier, nextTierPoints, progressPercent } = calculateCitizenTier(initialPoints);
  return {
    totalReports: 1,
    resolvedReports: 0,
    upvotesReceived: 2,
    streakWeeks: 1,
    civicPoints: initialPoints,
    tier,
    nextTierPoints,
    progressPercent,
  };
}

export async function updateCitizenImpact(
  totalReports: number,
  resolvedReports: number,
  upvotesReceived: number,
  streakWeeks: number = 1
): Promise<CitizenImpactScore> {
  // Point system:
  // - Report: +10 pts
  // - Resolution: +25 pts
  // - Upvote: +5 pts
  // - Streak week: +15 pts
  const civicPoints =
    totalReports * 10 +
    resolvedReports * 25 +
    upvotesReceived * 5 +
    streakWeeks * 15;

  const { tier, nextTierPoints, progressPercent } = calculateCitizenTier(civicPoints);

  const score: CitizenImpactScore = {
    totalReports,
    resolvedReports,
    upvotesReceived,
    streakWeeks,
    civicPoints,
    tier,
    nextTierPoints,
    progressPercent,
  };

  try {
    await AsyncStorage.setItem(IMPACT_CACHE_KEY, JSON.stringify(score));
  } catch (e) {
    console.warn('Failed to persist citizen impact:', e);
  }

  return score;
}
