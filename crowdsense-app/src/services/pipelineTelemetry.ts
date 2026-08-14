/**
 * pipelineTelemetry.ts
 * 
 * Aggregate, privacy-preserving performance & fallback telemetry.
 * Tracks how frequently on-device tiny ML models are used vs. falling back to rule-based logic.
 * Never stores or transmits PII, audio, or raw user transcripts.
 */

export interface TelemetryMetrics {
  totalInvocations: number;
  modelInvocations: number;
  fallbackInvocations: number;
  correctionsResolved: number;
  avgDurationMs: number;
}

export type PipelineStage = 
  | 'voice_asr'
  | 'voice_intent_classifier'
  | 'voice_entity_extractor'
  | 'phrase_translator_tiny';

class PipelineTelemetryService {
  private metrics: Record<PipelineStage, TelemetryMetrics> = {
    voice_asr: { totalInvocations: 0, modelInvocations: 0, fallbackInvocations: 0, correctionsResolved: 0, avgDurationMs: 0 },
    voice_intent_classifier: { totalInvocations: 0, modelInvocations: 0, fallbackInvocations: 0, correctionsResolved: 0, avgDurationMs: 0 },
    voice_entity_extractor: { totalInvocations: 0, modelInvocations: 0, fallbackInvocations: 0, correctionsResolved: 0, avgDurationMs: 0 },
    phrase_translator_tiny: { totalInvocations: 0, modelInvocations: 0, fallbackInvocations: 0, correctionsResolved: 0, avgDurationMs: 0 },
  };

  /**
   * Records a single execution event for a specific pipeline stage.
   */
  public recordEvent(
    stage: PipelineStage,
    isModelUsed: boolean,
    durationMs: number,
    isCorrection: boolean = false
  ): void {
    const m = this.metrics[stage];
    m.totalInvocations += 1;
    if (isModelUsed) {
      m.modelInvocations += 1;
    } else {
      m.fallbackInvocations += 1;
    }
    if (isCorrection) {
      m.correctionsResolved += 1;
    }

    // Incremental average duration calculation
    m.avgDurationMs = Math.round(
      (m.avgDurationMs * (m.totalInvocations - 1) + durationMs) / m.totalInvocations
    );
  }

  /**
   * Computes the fallback rate percentage (0.0% to 100.0%).
   */
  public getFallbackRate(stage: PipelineStage): number {
    const m = this.metrics[stage];
    if (m.totalInvocations === 0) return 0;
    return parseFloat(((m.fallbackInvocations / m.totalInvocations) * 100).toFixed(1));
  }

  /**
   * Retrieves all aggregate telemetry metrics.
   */
  public getMetricsSummary(): Record<PipelineStage, TelemetryMetrics & { fallbackRatePct: number }> {
    const summary: any = {};
    for (const [stage, m] of Object.entries(this.metrics)) {
      const s = stage as PipelineStage;
      summary[s] = {
        ...m,
        fallbackRatePct: this.getFallbackRate(s),
      };
    }
    return summary;
  }

  /**
   * Resets telemetry metrics (e.g. for testing).
   */
  public reset(): void {
    for (const stage of Object.keys(this.metrics)) {
      const s = stage as PipelineStage;
      this.metrics[s] = {
        totalInvocations: 0,
        modelInvocations: 0,
        fallbackInvocations: 0,
        correctionsResolved: 0,
        avgDurationMs: 0,
      };
    }
  }
}

export const pipelineTelemetry = new PipelineTelemetryService();
