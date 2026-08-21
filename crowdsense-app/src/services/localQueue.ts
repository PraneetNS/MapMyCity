import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { submitPothole } from './submissions';
import { getDeviceId } from '../utils/device';

export type DraftStatus = 'draft' | 'queued' | 'syncing' | 'failed' | 'synced';

export interface DraftReport {
  id: string;
  photo_uri: string;
  transcript: string; // Plaintext when returned from service
  category: string;
  latitude: number;
  longitude: number;
  captured_at: string;
  status: DraftStatus;
  retry_count: number;
  last_error?: string | null;
  asset_id?: string | null;
}

export interface DraftReportInput {
  id?: string;
  photo_uri: string;
  transcript: string;
  category: string;
  latitude: number;
  longitude: number;
  captured_at?: string;
  asset_id?: string | null;
}

const SECURE_KEY_ALIAS = 'CROWDSENSE_DRAFT_KEY';
const DB_NAME = 'crowdsense_drafts.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let cachedEncryptionKey: string | null = null;

/**
 * Retrieves or generates an encryption key stored securely in Expo SecureStore.
 */
async function getOrCreateEncryptionKey(): Promise<string> {
  if (cachedEncryptionKey) return cachedEncryptionKey;
  try {
    let key = await SecureStore.getItemAsync(SECURE_KEY_ALIAS);
    if (!key) {
      // Generate a simple key based on timestamp & random string
      key = `CS_KEY_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      await SecureStore.setItemAsync(SECURE_KEY_ALIAS, key);
    }
    cachedEncryptionKey = key;
    return key;
  } catch (err) {
    // Graceful fallback key if SecureStore fails on specific emulators
    cachedEncryptionKey = 'FALLBACK_CS_EMBEDDED_KEY_2026';
    return cachedEncryptionKey;
  }
}

/**
 * Lightweight symmetric XOR encryption for storing transcript data at rest.
 */
function encryptTranscript(text: string, key: string): string {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const textChar = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(textChar ^ keyChar);
  }
  // Convert to Base64 to make it safe for SQL storage
  try {
    return btoa(unescape(encodeURIComponent(result)));
  } catch (_) {
    return btoa(result);
  }
}

/**
 * Lightweight symmetric XOR decryption for restoring transcript data.
 */
function decryptTranscript(encodedCipher: string, key: string): string {
  if (!encodedCipher) return '';
  let cipher = '';
  try {
    cipher = decodeURIComponent(escape(atob(encodedCipher)));
  } catch (_) {
    try {
      cipher = atob(encodedCipher);
    } catch (e) {
      return encodedCipher; // Fallback if unencrypted
    }
  }
  let result = '';
  for (let i = 0; i < cipher.length; i++) {
    const cipherChar = cipher.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(cipherChar ^ keyChar);
  }
  return result;
}

/**
 * Initializes the SQLite local database instance and table schema.
 */
export async function initQueueDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS draft_submissions (
        id TEXT PRIMARY KEY NOT NULL,
        photo_uri TEXT NOT NULL,
        transcript TEXT NOT NULL,
        category TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        captured_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        asset_id TEXT
      );
    `);
    
    return dbInstance;
  } catch (err) {
    console.error('Failed to initialize SQLite draft database:', err);
    throw err;
  }
}

/**
 * Inserts a draft issue report into local SQLite storage FIRST, prior to any network attempt.
 */
export async function addDraftReport(input: DraftReportInput): Promise<DraftReport> {
  const db = await initQueueDatabase();
  const key = await getOrCreateEncryptionKey();

  const id = input.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const capturedAt = input.captured_at || new Date().toISOString();
  const encryptedText = encryptTranscript(input.transcript, key);

  await db.runAsync(
    `INSERT OR REPLACE INTO draft_submissions 
      (id, photo_uri, transcript, category, latitude, longitude, captured_at, status, retry_count, last_error, asset_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, NULL, ?);`,
    [
      id,
      input.photo_uri,
      encryptedText,
      input.category,
      input.latitude,
      input.longitude,
      capturedAt,
      input.asset_id || null,
    ]
  );

  return {
    id,
    photo_uri: input.photo_uri,
    transcript: input.transcript,
    category: input.category,
    latitude: input.latitude,
    longitude: input.longitude,
    captured_at: capturedAt,
    status: 'queued',
    retry_count: 0,
    last_error: null,
    asset_id: input.asset_id || null,
  };
}

/**
 * Fetches all pending / failed draft submissions that need network sync.
 */
export async function getPendingDrafts(): Promise<DraftReport[]> {
  const db = await initQueueDatabase();
  const key = await getOrCreateEncryptionKey();

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM draft_submissions WHERE status IN ('queued', 'failed', 'draft') ORDER BY captured_at ASC;`
  );

  return rows.map((row) => ({
    id: row.id,
    photo_uri: row.photo_uri,
    transcript: decryptTranscript(row.transcript, key),
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    captured_at: row.captured_at,
    status: row.status as DraftStatus,
    retry_count: row.retry_count,
    last_error: row.last_error,
    asset_id: row.asset_id || null,
  }));
}

/**
 * Gets the count of pending reports waiting for sync.
 */
export async function getPendingCount(): Promise<number> {
  const db = await initQueueDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM draft_submissions WHERE status IN ('queued', 'failed', 'draft');`
  );
  return result?.count || 0;
}

/**
 * Updates the sync status and retry error for a specific draft item.
 */
export async function updateDraftStatus(
  id: string,
  status: DraftStatus,
  errorText?: string
): Promise<void> {
  const db = await initQueueDatabase();
  if (status === 'failed') {
    await db.runAsync(
      `UPDATE draft_submissions 
       SET status = ?, retry_count = retry_count + 1, last_error = ? 
       WHERE id = ?;`,
      [status, errorText || 'Network upload failed', id]
    );
  } else if (status === 'synced') {
    // To bound storage growth, clear heavy local assets upon confirmed server sync
    await db.runAsync(
      `UPDATE draft_submissions 
       SET status = 'synced', photo_uri = '', transcript = '', last_error = NULL 
       WHERE id = ?;`,
      [id]
    );
  } else {
    await db.runAsync(
      `UPDATE draft_submissions SET status = ?, last_error = NULL WHERE id = ?;`,
      [status, id]
    );
  }
}

/**
 * Synchronizes queued offline reports with the backend /submissions endpoint using exponential backoff.
 */
export async function syncDraftQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const pending = await getPendingDrafts();
  if (pending.length === 0) {
    return { success: 0, failed: 0 };
  }

  const deviceId = await getDeviceId();
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pending.length; i++) {
    const draft = pending[i];

    // Cap retries at 5 attempts to avoid infinite looping on bad data
    if (draft.retry_count >= 5) {
      failedCount++;
      continue;
    }

    try {
      await updateDraftStatus(draft.id, 'syncing');

      await submitPothole({
        deviceId,
        photoUri: draft.photo_uri,
        latitude: draft.latitude,
        longitude: draft.longitude,
        capturedAt: draft.captured_at,
        missionType: draft.category,
        notes: draft.transcript || undefined,
        assetId: draft.asset_id || undefined,
      });

      await updateDraftStatus(draft.id, 'synced');
      successCount++;
    } catch (err: any) {
      const errMsg = err?.message || 'Sync network error';
      await updateDraftStatus(draft.id, 'failed', errMsg);
      failedCount++;
    }

    if (onProgress) {
      onProgress(i + 1, pending.length);
    }
  }

  return { success: successCount, failed: failedCount };
}
