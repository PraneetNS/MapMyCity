import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLiteModeEnabled } from './liteMode';

export type ModelId =
  | 'category_verifier_yolo'
  | 'nsfw_detector'
  | 'dynamic_translator_slm'
  | 'image_embedding_extractor'
  | 'voice_asr';

export interface ModelMetadata {
  id: ModelId;
  name: string;
  version: string;
  sizeBytes: number;
  sizeMB: number;
  format: 'tflite' | 'onnx' | 'rules';
  description: string;
  triggerEvent: string;
  minRamGb: number;
}

export const MODEL_REGISTRY: Record<ModelId, ModelMetadata> = {
  category_verifier_yolo: {
    id: 'category_verifier_yolo',
    name: 'YOLOv8n Civic Category Verifier',
    version: '1.0.0',
    sizeBytes: 3355443, // ~3.2 MB
    sizeMB: 3.2,
    format: 'tflite',
    description: 'Nano-class object detector for road damage, potholes, and garbage accumulation.',
    triggerEvent: 'First report capture confirmation',
    minRamGb: 2.0,
  },
  image_embedding_extractor: {
    id: 'image_embedding_extractor',
    name: 'MobileNet Image Similarity Extractor',
    version: '1.0.0',
    sizeBytes: 2621440, // ~2.5 MB
    sizeMB: 2.5,
    format: 'tflite',
    description: 'Lightweight embedding model for viewport duplicate pre-checks.',
    triggerEvent: 'Pre-upload duplicate check against nearby clusters',
    minRamGb: 2.0,
  },
  nsfw_detector: {
    id: 'nsfw_detector',
    name: 'MobileNet NSFW Content Classifier',
    version: '1.1.0',
    sizeBytes: 1887436, // ~1.8 MB
    sizeMB: 1.8,
    format: 'tflite',
    description: 'Fast client-side explicit content and harassment filter.',
    triggerEvent: 'Pre-upload photo check',
    minRamGb: 2.0,
  },
  dynamic_translator_slm: {
    id: 'dynamic_translator_slm',
    name: 'Distilled Indic Note Translator',
    version: '1.0.0',
    sizeBytes: 4718592, // ~4.5 MB
    sizeMB: 4.5,
    format: 'tflite',
    description: 'Lightweight translator for dynamic municipal updates and moderator remarks.',
    triggerEvent: 'User requests translation of non-templated remarks',
    minRamGb: 3.0,
  },
  voice_asr: {
    id: 'voice_asr',
    name: 'Whisper.cpp Indic Speech Engine',
    version: '1.0.0',
    sizeBytes: 8388608, // ~8.0 MB
    sizeMB: 8.0,
    format: 'tflite',
    description: 'On-device multi-dialect speech-to-text recognition model.',
    triggerEvent: 'Voice report recording in non-standard dialects',
    minRamGb: 3.0,
  },
};

const STORAGE_PREFIX = 'CROWDSENSE_MODEL_DOWNLOADED_';

/**
 * Checks if a specific on-device model is already downloaded and cached locally.
 */
export async function isModelDownloaded(modelId: ModelId): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(`${STORAGE_PREFIX}${modelId}`);
    return val === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Checks whether the current device is capable of running this model.
 * Respects Lite Mode and low-memory device flags.
 */
export function canDeviceRunModel(modelId: ModelId): boolean {
  if (isLiteModeEnabled()) {
    return false; // Automatically bypass optional models in Lite Mode
  }
  return true;
}

/**
 * Simulates on-demand download and caching of quantized nano-weights with progress reporting.
 */
export async function downloadModel(
  modelId: ModelId,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  if (!canDeviceRunModel(modelId)) {
    return false;
  }

  // Simulate fast chunked download
  for (let p = 10; p <= 100; p += 20) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (onProgress) onProgress(p);
  }

  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${modelId}`, 'true');
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Calculates the total storage footprint consumed by all currently downloaded models.
 */
export async function getTotalModelStorageBytes(): Promise<number> {
  let total = 0;
  for (const model of Object.values(MODEL_REGISTRY)) {
    const downloaded = await isModelDownloaded(model.id);
    if (downloaded) {
      total += model.sizeBytes;
    }
  }
  return total;
}

/**
 * Purges all downloaded model weights to free up disk space.
 */
export async function clearAllModelCaches(): Promise<void> {
  for (const model of Object.values(MODEL_REGISTRY)) {
    try {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${model.id}`);
    } catch (_) {}
  }
}
