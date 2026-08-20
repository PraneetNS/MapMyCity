export interface ResolutionPrediction {
  expectedDays: number;
  label: string;
  confidence: number;
}

const CATEGORY_DAYS_MAP: Record<string, number> = {
  pothole: 3,
  garbage: 1,
  safety_concern: 2,
  infrastructure: 5,
  accessibility: 7,
  utility_outage: 1,
  noise: 1,
};

/**
 * Returns expected resolution time estimate based on historical category statistics.
 */
export function getPredictiveResolutionEstimate(category: string): ResolutionPrediction {
  const cat = (category || 'pothole').toLowerCase();
  const days = CATEGORY_DAYS_MAP[cat] || 3;

  return {
    expectedDays: days,
    label: `Typically resolved in ~${days} day${days > 1 ? 's' : ''}`,
    confidence: 0.88,
  };
}

export interface ClientRecurrencePrediction {
  recurrenceProbabilityPct: number;
  riskLevel: 'low' | 'medium' | 'high';
  isHighRisk: boolean;
  recommendation: string;
}

const CATEGORY_RECURRENCE_MAP: Record<string, number> = {
  pothole: 42,
  garbage: 68,
  safety_concern: 35,
  infrastructure: 25,
  utility_outage: 45,
  accessibility: 20,
  noise: 55,
};

/**
 * Returns on-device baseline recurrence likelihood estimate for a category.
 */
export function getPredictiveRecurrenceEstimate(
  category: string,
  submissionCount: number = 1
): ClientRecurrencePrediction {
  const cat = (category || 'pothole').toLowerCase();
  let basePct = CATEGORY_RECURRENCE_MAP[cat] || 30;
  if (submissionCount >= 5) {
    basePct = Math.min(95, basePct + 15);
  }

  const isHighRisk = basePct >= 65;
  const riskLevel = isHighRisk ? 'high' : basePct >= 38 ? 'medium' : 'low';

  return {
    recurrenceProbabilityPct: basePct,
    riskLevel,
    isHighRisk,
    recommendation: isHighRisk
      ? 'High recurrence risk — monitor after resolution'
      : 'Standard lifecycle expected',
  };
}

