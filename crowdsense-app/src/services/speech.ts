let ExpoSpeechRecognitionModule: any = null;
try {
  ExpoSpeechRecognitionModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch (_) {
  console.log('[Speech] expo-speech-recognition native module not bundled in standard Expo Go.');
}

export interface SupportedLocale {
  code: string;
  name: string;
}

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'Hindi (हिंदी)' },
  { code: 'ta-IN', name: 'Tamil (தமிழ்)' },
  { code: 'te-IN', name: 'Telugu (తెలుగు)' },
  { code: 'mr-IN', name: 'Marathi (मराठी)' },
];

export interface SpeechRecognitionCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd?: () => void;
}

let resultSubscription: any = null;
let errorSubscription: any = null;
let endSubscription: any = null;

/**
 * Checks if on-device SpeechRecognition engine is available on the current device.
 */
export async function isSpeechRecognitionAvailable(): Promise<boolean> {
  try {
    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function') {
      return await ExpoSpeechRecognitionModule.isRecognitionAvailable();
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Requests speech recognition permissions from the native operating system.
 */
export async function requestSpeechPermissions(): Promise<boolean> {
  try {
    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function') {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Starts on-device speech-to-text recording.
 */
export async function startSpeechRecognition(
  localeCode: string,
  callbacks: SpeechRecognitionCallbacks
): Promise<void> {
  const isAvailable = await isSpeechRecognitionAvailable();
  if (!isAvailable) {
    callbacks.onError('On-device speech recognition is not supported on this device.');
    return;
  }

  const hasPermission = await requestSpeechPermissions();
  if (!hasPermission) {
    callbacks.onError('Microphone & Speech permissions were denied.');
    return;
  }

  // Clean up any existing listeners
  stopSpeechRecognition();

  try {
    resultSubscription = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
      const transcript = event.results?.[0]?.transcript || event.transcript || '';
      callbacks.onResult(transcript, event.isFinal ?? true);
    });

    errorSubscription = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
      callbacks.onError(event.error || event.message || 'Speech recognition error');
    });

    endSubscription = ExpoSpeechRecognitionModule.addListener('end', () => {
      if (callbacks.onEnd) callbacks.onEnd();
    });

    ExpoSpeechRecognitionModule.start({
      lang: localeCode || 'en-IN',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: true,
    });
  } catch (err: any) {
    callbacks.onError(err?.message || 'Failed to start speech recognition');
  }
}

/**
 * Stops any active speech recognition session.
 */
export async function stopSpeechRecognition(): Promise<void> {
  try {
    if (resultSubscription?.remove) resultSubscription.remove();
    if (errorSubscription?.remove) errorSubscription.remove();
    if (endSubscription?.remove) endSubscription.remove();
  } catch (_) {}

  resultSubscription = null;
  errorSubscription = null;
  endSubscription = null;

  try {
    if (ExpoSpeechRecognitionModule && typeof ExpoSpeechRecognitionModule.stop === 'function') {
      ExpoSpeechRecognitionModule.stop();
    }
  } catch (_) {}
}

/**
 * Interface stub for audio file transcription (swap point for future whisper.cpp / on-device ML model).
 * Fallback path: returns transcript if provided or degrades gracefully.
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  console.log('[ASR Swap Point] transcribeAudio called with URI:', audioUri);
  // Stub for future whisper.cpp / TFLite ASR integration
  // Raw audio never leaves device by default.
  return Promise.resolve('');
}
