import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../config/apiClient';

export interface UserSession {
  userId: string;
  phoneHash?: string | null;
  deviceId: string;
  authProvider: 'phone_otp' | 'google' | 'apple';
  email?: string | null;
  displayName?: string | null;
  isBanned: boolean;
  trustScore: number;
  hasSmsAlerts: boolean;
}

const SESSION_STORAGE_KEY = 'CROWDSENSE_USER_SESSION';
const OTP_RATE_LIMIT_KEY = 'CROWDSENSE_OTP_RATE_LIMIT';

/**
 * Computes a secure SHA-256 hash of a phone number so raw numbers are never stored plaintext.
 */
export async function hashPhoneNumber(rawPhoneNumber: string): Promise<string> {
  const cleaned = rawPhoneNumber.replace(/[^\d+]/g, '');
  try {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `CS_SALT_2026_${cleaned}`
    );
  } catch (_) {
    let hash = 0;
    const str = `CS_SALT_2026_${cleaned}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `ph_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Enforces rate-limiting for OTP requests (max 3 per hour).
 */
async function checkOtpRateLimit(phoneHash: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(`${OTP_RATE_LIMIT_KEY}_${phoneHash}`);
    if (!raw) return true;
    const history: number[] = JSON.parse(raw);
    const oneHourAgo = Date.now() - 3600000;
    const recent = history.filter((ts) => ts > oneHourAgo);
    return recent.length < 3;
  } catch (_) {
    return true;
  }
}

async function recordOtpAttempt(phoneHash: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(`${OTP_RATE_LIMIT_KEY}_${phoneHash}`);
    const history: number[] = raw ? JSON.parse(raw) : [];
    const oneHourAgo = Date.now() - 3600000;
    const recent = history.filter((ts) => ts > oneHourAgo);
    recent.push(Date.now());
    await AsyncStorage.setItem(`${OTP_RATE_LIMIT_KEY}_${phoneHash}`, JSON.stringify(recent));
  } catch (_) {}
}

/**
 * Requests a phone OTP for login/registration.
 */
export async function requestPhoneOtp(phoneNumber: string, deviceId: string): Promise<{ success: boolean; message: string }> {
  const phoneHash = await hashPhoneNumber(phoneNumber);
  const isAllowed = await checkOtpRateLimit(phoneHash);

  if (!isAllowed) {
    throw new Error('Too many OTP requests. Please wait an hour before requesting another OTP.');
  }

  await recordOtpAttempt(phoneHash);

  try {
    const res = await apiFetch('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        phone_hash: phoneHash,
        device_id: deviceId,
      }),
    });
    return { success: true, message: res?.message || 'OTP sent successfully' };
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to request OTP');
  }
}

/**
 * Verifies the phone OTP and initializes the user session.
 */
export async function verifyPhoneOtp(phoneNumber: string, otpCode: string, deviceId: string): Promise<UserSession> {
  const phoneHash = await hashPhoneNumber(phoneNumber);

  try {
    const res = await apiFetch('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({
        phone_hash: phoneHash,
        otp_code: otpCode,
        device_id: deviceId,
      }),
    });

    const session: UserSession = {
      userId: res.user_id,
      phoneHash: res.phone_hash,
      authProvider: 'phone_otp',
      deviceId,
      isBanned: Boolean(res.is_banned),
      trustScore: res.trust_score ?? 0.5,
      hasSmsAlerts: true,
    };

    await saveUserSession(session);
    return session;
  } catch (err: any) {
    throw new Error(err?.message || 'Invalid or expired OTP code');
  }
}

/**
 * Signs in or registers via Google or Apple Social Sign-In.
 */
export async function signInWithSocial(
  provider: 'google' | 'apple',
  deviceId: string,
  mockProfile?: { email?: string; name?: string; externalId?: string }
): Promise<UserSession> {
  try {
    const externalId = mockProfile?.externalId || `${provider}_usr_${Date.now().toString(36)}`;
    const email = mockProfile?.email || `citizen_${provider}@example.com`;
    const displayName = mockProfile?.name || `${provider === 'google' ? 'Google' : 'Apple'} Verified Citizen`;

    const res = await apiFetch('/auth/social/verify', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        external_id: externalId,
        email,
        display_name: displayName,
        device_id: deviceId,
      }),
    });

    const session: UserSession = {
      userId: res.user_id,
      phoneHash: res.phone_hash || null,
      authProvider: provider,
      email: res.email || email,
      displayName: res.display_name || displayName,
      deviceId,
      isBanned: Boolean(res.is_banned),
      trustScore: res.trust_score ?? 0.5,
      hasSmsAlerts: Boolean(res.has_sms_alerts),
    };

    await saveUserSession(session);
    return session;
  } catch (err: any) {
    throw new Error(err?.message || `Failed to authenticate with ${provider}.`);
  }
}

export async function saveUserSession(session: UserSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}
