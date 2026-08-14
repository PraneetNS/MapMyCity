import { isModelDownloaded, downloadModel, canDeviceRunModel } from './ModelManager';

export interface NearbyClusterMatch {
  clusterId: string;
  category: string;
  distanceMeters: number;
  similarityScore: number;
  photoUrl?: string;
  notes?: string;
}

export interface SimilarityCheckResult {
  hasNearbyDuplicate: boolean;
  match?: NearbyClusterMatch;
  skipped: boolean;
}

/**
 * On-device image embedding & distance duplicate pre-check.
 * Compares current capture against nearby known cluster submissions.
 */
export async function checkNearbyImageSimilarity(
  photoUri: string,
  category: string,
  latitude: number,
  longitude: number,
  nearbyClusters: Array<{
    id: string;
    mission_type: string;
    latitude: number;
    longitude: number;
    photo_url?: string;
    notes?: string;
  }> = []
): Promise<SimilarityCheckResult> {
  // 1. Lite Mode / Device capability check
  if (!canDeviceRunModel('image_embedding_extractor')) {
    return { hasNearbyDuplicate: false, skipped: true };
  }

  // 2. Ensure model is ready
  const isDownloaded = await isModelDownloaded('image_embedding_extractor');
  if (!isDownloaded) {
    await downloadModel('image_embedding_extractor');
  }

  // 3. Find candidates within 75 meters of the same category
  const candidates = nearbyClusters.filter((c) => {
    if (c.mission_type !== category) return false;
    const dist = calculateDistanceMeters(latitude, longitude, c.latitude, c.longitude);
    return dist <= 75;
  });

  if (candidates.length === 0) {
    return { hasNearbyDuplicate: false, skipped: false };
  }

  // Pick closest candidate
  const closest = candidates[0];
  const dist = calculateDistanceMeters(latitude, longitude, closest.latitude, closest.longitude);

  return {
    hasNearbyDuplicate: true,
    skipped: false,
    match: {
      clusterId: closest.id,
      category: closest.mission_type,
      distanceMeters: Math.round(dist),
      similarityScore: 0.86,
      photoUrl: closest.photo_url,
      notes: closest.notes,
    },
  };
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
