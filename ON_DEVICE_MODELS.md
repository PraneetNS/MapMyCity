# On-Device Machine Learning Models & Execution Strategy

This document details all on-device machine learning models utilized across the **CrowdSense** mobile application, their footprint, trigger points, and fallback mechanisms.

---

## Architecture Principles

1. **Zero Base Bundle Bloat**: No heavy model binaries or weights are bundled into the base APK/AAB package.
2. **Download on First Use**: Optional models are downloaded on-demand only when a user triggers the corresponding feature, with transparent progress reporting.
3. **Lite Mode & Low-RAM Degradation**: On entry-level devices (~2GB RAM / Android Go) or when Lite Mode is toggled on, all on-device models degrade gracefully to server-side moderation without blocking the user.
4. **Soft Blocks with Human Override**: Visual verification never acts as an un-overridable wall. Users can override false negatives with a clear "This is correct, submit anyway" option that routes the report to priority human review.

---

## Registered Model Matrix

| Model Identifier | Purpose / Task | Format & Runtime | Size (MB) | Trigger Event | Fallback Behavior |
|---|---|---|---|---|---|
| `category_verifier_yolo` | YOLOv8n visual category verification (Pothole, Garbage, Infrastructure) | TFLite / Quantized INT8 | **3.2 MB** | CaptureScreen confirmation | Bypass model & proceed to server-side moderation |
| `nsfw_detector` | MobileNet client-side explicit content and harassment filter | TFLite / Quantized INT8 | **1.8 MB** | Pre-upload photo check | Sightengine server moderation check |
| `dynamic_translator_slm` | Distilled Indic language translator for non-templated remarks | TFLite / Quantized INT8 | **4.5 MB** | On-demand "Translate note" click | Display original language text |
| `voice_asr` | Whisper.cpp Indic speech-to-text transcription engine | TFLite / Mobile WebAssembly | **8.0 MB** | Native speech recognition fallback | Plaintext typing or server transcription |

---

## Category Verification Details (YOLOv8n)

### Supported Classes
- **`pothole`**: Road damage, asphalt craters, road surface depressions (Confidence threshold: `0.35`).
- **`garbage`**: Trash piles, waste heaps, overflowing dumpsters, scattered plastic litter (Confidence threshold: `0.35`).
- **`infrastructure`**: Damaged poles, broken pipes, structural fractures (Confidence threshold: `0.30`, best-effort).

### Deliberately Skipped Categories
- **`accessibility`**: Missing ramps or broken tactile paving represent an *absence* of features, which object bounding-box detectors handle poorly. Handled via structured NGO audit checklist form.
- **`noise`**: Audio/decibel reports are non-visual and not verifiable via camera imagery.

---

## Storage & Pruning
- All model weights are tracked by `ModelManager.ts` and reported in real-time to `cacheManager.ts`.
- Users can clear downloaded model weights at any time from **Profile & Settings → Storage & Cache → Clear Storage Cache**.
