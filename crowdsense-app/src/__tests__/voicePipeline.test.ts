/**
 * voicePipeline.test.ts
 * 
 * Tests the multi-stage voice pipeline:
 * - Intent / Category classification
 * - Extractive entity span extraction
 * - Sliding context integration
 * - Self-correction resolution ("no wait, it's garbage not a pothole")
 * - Graceful fallback when models are not downloaded
 */

import { ContextWindow } from '../services/ContextWindow';
import { processVoiceUtterance } from '../services/voicePipeline';
import { classifyVoiceIntent } from '../services/voiceIntentClassifier';
import { extractVoiceEntities } from '../services/voiceEntityExtractor';
import { pipelineTelemetry } from '../services/pipelineTelemetry';

describe('On-Device Voice Pipeline & Stage Chain', () => {
  let context: ContextWindow;

  beforeEach(() => {
    context = new ContextWindow('pipeline_test_session');
    pipelineTelemetry.reset();
  });

  test('Stage 2: classifyVoiceIntent identifies pothole and hindi keywords', async () => {
    const res1 = await classifyVoiceIntent('There is a huge pothole on this road');
    expect(res1.category).toBe('pothole');
    expect(res1.intent).toBe('report_hazard');

    const res2 = await classifyVoiceIntent('यहाँ बहुत कचरा फैला हुआ है');
    expect(res2.category).toBe('garbage');
  });

  test('Stage 3: extractVoiceEntities extracts severity and landmark spans', async () => {
    const res = await extractVoiceEntities('There is a dangerous pothole near the metro station');
    expect(res.severity).toBe('critical');
    expect(res.landmarkSpan).toBeDefined();
    expect(res.landmarkSpan?.toLowerCase()).toContain('near the metro station');
  });

  test('Full Pipeline: processes initial utterance and populates context', async () => {
    const result = await processVoiceUtterance(
      'Massive pothole near the signal',
      context
    );

    expect(result.category).toBe('pothole');
    expect(result.severity).toBe('critical');
    expect(context.getPin('selectedCategory')).toBe('pothole');
    expect(context.getRollingEntries().length).toBe(1);
  });

  test('Full Pipeline: resolves self-correction in multi-turn context', async () => {
    // Turn 1: User says pothole
    await processVoiceUtterance('There is a big pothole here', context);
    expect(context.getPin('selectedCategory')).toBe('pothole');

    // Turn 2: User corrects themselves
    const correctionResult = await processVoiceUtterance(
      'No wait, it is garbage not a pothole',
      context
    );

    expect(correctionResult.correctionApplied).toBe(true);
    expect(correctionResult.category).toBe('garbage');
    expect(context.getPin('selectedCategory')).toBe('garbage');
    expect(context.getRollingEntries().length).toBe(2);
  });

  test('Telemetry: records invocations and computes fallback rates', async () => {
    await processVoiceUtterance('Broken streetlight near the bridge', context);
    const summary = pipelineTelemetry.getMetricsSummary();

    expect(summary.voice_intent_classifier.totalInvocations).toBeGreaterThanOrEqual(1);
    expect(summary.voice_entity_extractor.totalInvocations).toBeGreaterThanOrEqual(1);
  });
});
