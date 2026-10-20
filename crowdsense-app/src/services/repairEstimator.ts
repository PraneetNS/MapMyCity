import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export interface RepairMaterialsBreakdown {
  asphaltMixKg: number;
  asphaltMixTonnes: number;
  tackCoatEmulsionKg: number;
  granularSubbaseKg: number;
  needsBaseCourseReinstatement: boolean;
  mixGrade: string;
}

export interface RepairFinancials {
  materialsCost: number;
  laborCost: number;
  equipmentCost: number;
  trafficMultiplier: number;
  contingencyPct: number;
  totalEstimatedCost: number;
}

export interface RepairBOMEstimate {
  defectType: string;
  surfaceAreaSqm: number;
  depthCm: number;
  estimatedVolumeCum: number;
  materials: RepairMaterialsBreakdown;
  financials: RepairFinancials;
  operational: {
    durationHours: number;
    rollerCompactionHours: number;
    recommendedCrewSize: number;
  };
  environmental: {
    embodiedCarbonKg: number;
    co2MitigationScore: number;
  };
  confidenceScore: number;
  scheduleStandard: string;
  isOfflineEstimate: boolean;
}

const CACHED_ESTIMATES_KEY = '@crowdsense_cached_repair_estimates';

/**
 * Pure local offline computation adhering to CPWD DSR 2024 rates
 */
export function computeLocalRepairEstimate(
  surfaceAreaSqm: number,
  depthCm: number,
  trafficTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'HEAVY_CORRIDOR' = 'MEDIUM',
  emergencyPatch: boolean = false
): RepairBOMEstimate {
  const area = Math.max(0.05, surfaceAreaSqm);
  const depthM = Math.max(0.02, depthCm / 100.0);
  const engineeredArea = Number((area * 1.15).toFixed(3));
  const volumeCum = Number((engineeredArea * depthM).toFixed(4));

  const needsBaseCourse = depthM > 0.06;
  const baseThickness = needsBaseCourse ? depthM * 0.45 : 0;
  const wearingThickness = needsBaseCourse ? depthM * 0.55 : depthM;

  const baseVol = engineeredArea * baseThickness;
  const wearingVol = engineeredArea * wearingThickness;

  const asphaltKg = Number((wearingVol * 2400.0).toFixed(2));
  const asphaltTonnes = Number((asphaltKg / 1000.0).toFixed(3));
  const tackCoatKg = Number((engineeredArea * 0.25).toFixed(2));
  const aggregateKg = Number((baseVol * 2200.0).toFixed(2));

  const asphaltCost = emergencyPatch ? asphaltTonnes * 6200.0 : asphaltTonnes * 4850.0;
  const tackCost = tackCoatKg * 78.0;
  const aggCost = baseVol * 1650.0;
  const materialsCost = asphaltCost + tackCost + aggCost;

  const workHours = Number(Math.min(12.0, 2.0 + engineeredArea * 0.35 + (needsBaseCourse ? 1.0 : 0.0)).toFixed(1));
  const rollerHours = Number(Math.max(1.0, workHours * 0.5).toFixed(1));

  const equipmentCost = rollerHours * 950.0 + 1500.0;
  const laborCost = workHours * 850.0;

  const trafficMultipliers: Record<string, number> = {
    LOW: 1.0,
    MEDIUM: 1.1,
    HIGH: 1.25,
    HEAVY_CORRIDOR: 1.4,
  };
  const mult = trafficMultipliers[trafficTier] || 1.1;

  const subtotal = (materialsCost + equipmentCost + laborCost) * mult;
  const contingency = subtotal * 0.1;
  const totalCost = Number((subtotal + contingency).toFixed(2));

  const embodiedCarbon = Number((asphaltKg * 0.052 + aggregateKg * 0.012).toFixed(2));

  return {
    defectType: 'pothole',
    surfaceAreaSqm: engineeredArea,
    depthCm: Number((depthM * 100).toFixed(1)),
    estimatedVolumeCum: volumeCum,
    materials: {
      asphaltMixKg: asphaltKg,
      asphaltMixTonnes: asphaltTonnes,
      tackCoatEmulsionKg: tackCoatKg,
      granularSubbaseKg: aggregateKg,
      needsBaseCourseReinstatement: needsBaseCourse,
      mixGrade: emergencyPatch ? 'COLD_PATCH_POLYMER' : 'VG-30_BITUMINOUS_CONCRETE',
    },
    financials: {
      materialsCost: Number(materialsCost.toFixed(2)),
      laborCost: Number(laborCost.toFixed(2)),
      equipmentCost: Number(equipmentCost.toFixed(2)),
      trafficMultiplier: mult,
      contingencyPct: 10,
      totalEstimatedCost: totalCost,
    },
    operational: {
      durationHours: workHours,
      rollerCompactionHours: rollerHours,
      recommendedCrewSize: needsBaseCourse ? 6 : 4,
    },
    environmental: {
      embodiedCarbonKg: embodiedCarbon,
      co2MitigationScore: Number(Math.max(10, 100 - embodiedCarbon * 0.4).toFixed(1)),
    },
    confidenceScore: engineeredArea < 5.0 ? 0.92 : 0.84,
    scheduleStandard: 'CPWD_DSR_2024',
    isOfflineEstimate: true,
  };
}

/**
 * Requests BOM and cost calculation from FastAPI, falling back to local computation
 */
export async function calculateRepairEstimate(
  surfaceAreaSqm: number,
  depthCm: number,
  trafficTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'HEAVY_CORRIDOR' = 'MEDIUM',
  emergencyPatch: boolean = false
): Promise<RepairBOMEstimate> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/repair-costs/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surface_area_sqm: surfaceAreaSqm,
        depth_cm: depthCm,
        traffic_tier: trafficTier,
        emergency_patch: emergencyPatch,
        contingency_pct: 10.0,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const estimate: RepairBOMEstimate = {
        defectType: data.defect_type,
        surfaceAreaSqm: data.surface_area_sqm,
        depthCm: data.depth_cm,
        estimatedVolumeCum: data.estimated_volume_cum,
        materials: {
          asphaltMixKg: data.materials_breakdown.asphalt_mix_kg,
          asphaltMixTonnes: data.materials_breakdown.asphalt_mix_tonnes,
          tackCoatEmulsionKg: data.materials_breakdown.tack_coat_emulsion_kg,
          granularSubbaseKg: data.materials_breakdown.granular_subbase_kg,
          needsBaseCourseReinstatement: data.materials_breakdown.needs_base_course_reinstatement,
          mixGrade: data.materials_breakdown.mix_grade,
        },
        financials: {
          materialsCost: data.financial_breakdown_inr.materials_cost,
          laborCost: data.financial_breakdown_inr.labor_cost,
          equipmentCost: data.financial_breakdown_inr.equipment_and_mobilization_cost,
          trafficMultiplier: data.financial_breakdown_inr.traffic_factor_multiplier,
          contingencyPct: data.financial_breakdown_inr.contingency_pct,
          totalEstimatedCost: data.financial_breakdown_inr.total_estimated_cost,
        },
        operational: {
          durationHours: data.operational_estimates.estimated_repair_duration_hours,
          rollerCompactionHours: data.operational_estimates.roller_compaction_hours,
          recommendedCrewSize: data.operational_estimates.recommended_crew_size,
        },
        environmental: {
          embodiedCarbonKg: data.environmental_impact.embodied_carbon_kg_co2e,
          co2MitigationScore: data.environmental_impact.co2_mitigation_benefit_score,
        },
        confidenceScore: data.confidence_score,
        scheduleStandard: data.schedule_standard,
        isOfflineEstimate: false,
      };

      await cacheEstimate(estimate);
      return estimate;
    }
  } catch (err) {
    // Graceful offline fallback
  }

  const localEstimate = computeLocalRepairEstimate(surfaceAreaSqm, depthCm, trafficTier, emergencyPatch);
  await cacheEstimate(localEstimate);
  return localEstimate;
}

async function cacheEstimate(estimate: RepairBOMEstimate) {
  try {
    const raw = await AsyncStorage.getItem(CACHED_ESTIMATES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(estimate);
    await AsyncStorage.setItem(CACHED_ESTIMATES_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // Ignore cache write error
  }
}
