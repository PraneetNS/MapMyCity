/**
 * voicePipeline.ts
 * 
 * End-to-End Orchestrator for the On-Device Voice Pipeline.
 * 
 * Architecture:
 *   [Voice Audio]
 *         │
 *         ▼
 *   Stage 1: ASR (Speech-to-Text via native/whisper)
 *         │
 *         ▼
 *   Stage 2: Intent & Category Classifier (~5.8MB model / rule fallback)
 *         │
 *         ▼
 *   Stage 3: Entity & Span Extractor (~4.2MB model / rule fallback)
 *         │
 *         ▼
 *   Context Integration: Sliding ContextWindow resolution & self-correction
 * 
 * Guarantees:
 * - Completely bounded memory (via ContextWindow).
 * - Independent stage degradation (never hangs or blocks UI).
 * - Multi-turn conversational self-correction.
 */

import { ContextWindow, defaultSessionContext } from './ContextWindow';
import { classifyVoiceIntent, IntentClassificationResult } from './voiceIntentClassifier';
import { extractVoiceEntities, ExtractedEntities } from './voiceEntityExtractor';
import { pipelineTelemetry } from './pipelineTelemetry';
import { MissionTypeId } from './classifier';

export interface PipelineExecutionResult {
  category: MissionTypeId | 'unknown';
  intent: string;
  notes: string;
  landmark?: string;
  severity?: string;
  correctionApplied: boolean;
  contextSummary: string;
  stages: {
    intentModelUsed: boolean;
    extractorModelUsed: boolean;
    totalLatencyMs: number;
  };
}

/**
 * Processes a single voice utterance through the on-device ML pipeline.
 * Updates the associated ContextWindow with the new turn and pinned session facts.
 */
export async function processVoiceUtterance(
  rawTranscript: string,
  contextWindow: ContextWindow = defaultSessionContext
): Promise<PipelineExecutionResult> {
  const startTime = Date.now();
  const transcript = rawTranscript.trim();

  // 1. Get previously pinned state from sliding context
  const previousCategory = contextWindow.getPin<MissionTypeId>('selectedCategory');
  const previousNotes = contextWindow.getPin<string>('notes') || '';

  // 2. Stage 2: Intent & Category Classification
  const t1 = Date.now();
  const intentResult: IntentClassificationResult = await classifyVoiceIntent(
    transcript,
    previousCategory
  );
  const intentDuration = Date.now() - t1;
  pipelineTelemetry.recordEvent(
    'voice_intent_classifier',
    intentResult.isModelInference,
    intentDuration,
    intentResult.correctionDetected
  );

  // 3. Stage 3: Entity & Landmark Span Extraction
  const t2 = Date.now();
  const entityResult: ExtractedEntities = await extractVoiceEntities(transcript);
  const entityDuration = Date.now() - t2;
  pipelineTelemetry.recordEvent(
    'voice_entity_extractor',
    entityResult.isModelExtracted,
    entityDuration
  );

  // 4. Resolve Context & Handle Self-Corrections
  let resolvedCategory = intentResult.category;
  let correctionApplied = false;

  if (intentResult.correctionDetected) {
    correctionApplied = true;
    if (intentResult.category !== 'unknown') {
      resolvedCategory = intentResult.category;
      contextWindow.pin('selectedCategory', resolvedCategory);
    }
  } else if (resolvedCategory !== 'unknown') {
    contextWindow.pin('selectedCategory', resolvedCategory);
  } else if (previousCategory) {
    // Retain previous pinned category if current turn was an elaboration (e.g. "it is near the temple")
    resolvedCategory = previousCategory;
  }

  // 5. Accumulate / merge notes without unbounded length
  let resolvedNotes = entityResult.notesSummary;
  if (previousNotes && !intentResult.correctionDetected && entityResult.notesSummary) {
    resolvedNotes = `${previousNotes}; ${entityResult.notesSummary}`.slice(0, 300);
  }
  contextWindow.pin('notes', resolvedNotes);

  if (entityResult.landmarkSpan) {
    contextWindow.pin('landmark', entityResult.landmarkSpan);
  }
  if (entityResult.severity) {
    contextWindow.pin('severity', entityResult.severity);
  }

  // 6. Record turn in rolling context buffer
  contextWindow.add(
    transcript,
    'user',
    correctionApplied ? 'correction' : 'intent_classification',
    {
      category: resolvedCategory,
      isModel: intentResult.isModelInference,
      entities: entityResult.qualifiers,
    }
  );

  const totalLatencyMs = Date.now() - startTime;

  return {
    category: resolvedCategory,
    intent: intentResult.intent,
    notes: resolvedNotes,
    landmark: entityResult.landmarkSpan,
    severity: entityResult.severity,
    correctionApplied,
    contextSummary: contextWindow.getContextSummary(),
    stages: {
      intentModelUsed: intentResult.isModelInference,
      extractorModelUsed: entityResult.isModelExtracted,
      totalLatencyMs,
    },
  };
}
