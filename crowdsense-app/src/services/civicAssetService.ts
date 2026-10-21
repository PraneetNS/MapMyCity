import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export interface CivicAsset {
  id: string;
  asset_code: string;
  asset_type: 'streetlight' | 'manhole' | 'traffic_signal' | 'transformer' | 'water_hydrant' | 'bus_shelter' | 'storm_drain' | string;
  ward_id: string;
  location_description: string;
  latitude: number;
  longitude: number;
  qr_payload: string;
  qr_verification_token?: string;
  department: string;
  installation_year: number;
  last_inspected_at: string | null;
  health_status: 'OPERATIONAL' | 'DEGRADED' | 'FAULTY' | 'HAZARDOUS' | 'DECOMMISSIONED';
  active_cluster_id?: string | null;
  distance_meters?: number;
}

export interface AssetInspectionRecord {
  id: string;
  asset_tag_id: string;
  asset_code: string;
  inspector_id: string;
  inspector_role: string;
  condition_rating: number;
  reported_defect?: string;
  notes?: string;
  photo_url?: string;
  health_status: string;
  created_at: string;
}

const ASSET_CACHE_KEY = '@crowdsense_civic_assets_cache';

export async function lookupAssetByQR(qrOrCode: string): Promise<CivicAsset> {
  const clean = qrOrCode.trim();
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/assets/lookup?qr=${encodeURIComponent(clean)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const asset: CivicAsset = await res.json();
      await cacheAssetLocally(asset);
      return asset;
    }
  } catch (err) {
    console.warn('[civicAssetService] Network lookup failed, falling back to local cache:', err);
  }

  // Fallback to cache or fallback mock
  const cached = await getCachedAsset(clean);
  if (cached) return cached;

  // Extract code if URL
  let code = clean;
  if (clean.includes('asset/')) {
    code = clean.split('asset/')[1].split('?')[0];
  }

  return {
    id: `local-asset-${Date.now()}`,
    asset_code: code.toUpperCase(),
    asset_type: 'streetlight',
    ward_id: 'ward_101',
    location_description: 'Registered Civic Asset (Offline Mode)',
    latitude: 12.971891,
    longitude: 77.641154,
    qr_payload: clean,
    department: 'BBMP_CIVIC_WORKS',
    installation_year: 2022,
    last_inspected_at: new Date().toISOString(),
    health_status: 'OPERATIONAL',
  };
}

export async function fetchNearbyAssets(lat: number, lon: number, radiusMeters: number = 1000): Promise<CivicAsset[]> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/assets/nearby?lat=${lat}&lon=${lon}&radius_meters=${radiusMeters}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (res.ok) {
      const list: CivicAsset[] = await res.json();
      return list;
    }
  } catch (err) {
    console.warn('[civicAssetService] Failed fetching nearby assets:', err);
  }
  return [];
}

export async function recordAssetInspection(
  assetCode: string,
  conditionRating: number,
  notes?: string,
  reportedDefect?: string,
  photoUrl?: string,
  inspectorId: string = 'citizen'
): Promise<AssetInspectionRecord> {
  const payload = {
    condition_rating: conditionRating,
    inspector_id: inspectorId,
    inspector_role: 'citizen',
    reported_defect: reportedDefect,
    notes: notes,
    photo_url: photoUrl,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/assets/${encodeURIComponent(assetCode)}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[civicAssetService] Inspection offline record:', err);
  }

  return {
    id: `insp-offline-${Date.now()}`,
    asset_tag_id: `asset-${assetCode}`,
    asset_code: assetCode,
    inspector_id: inspectorId,
    inspector_role: 'citizen',
    condition_rating: conditionRating,
    reported_defect: reportedDefect,
    notes: notes,
    photo_url: photoUrl,
    health_status: conditionRating <= 2 ? 'FAULTY' : conditionRating === 3 ? 'DEGRADED' : 'OPERATIONAL',
    created_at: new Date().toISOString(),
  };
}

async function cacheAssetLocally(asset: CivicAsset) {
  try {
    const raw = await AsyncStorage.getItem(ASSET_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[asset.asset_code] = asset;
    await AsyncStorage.setItem(ASSET_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

async function getCachedAsset(codeOrUrl: string): Promise<CivicAsset | null> {
  try {
    const raw = await AsyncStorage.getItem(ASSET_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    for (const key of Object.keys(map)) {
      if (codeOrUrl.includes(key)) return map[key];
    }
  } catch {
    // ignore
  }
  return null;
}
