import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'crowdsense.deviceId';

function generateDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

export async function getDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const nextId = generateDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, nextId);

  return nextId;
}
