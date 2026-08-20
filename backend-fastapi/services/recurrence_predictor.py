"""
Civic Issue Recurrence & Reopening Risk Predictor
Predicts the probability of a cluster/issue reopening or recurring after resolution.
Uses statistical / logistic scoring combining category vulnerability, past reopen history,
submission density, and seasonal/infrastructure risk factors.
"""

from typing import Dict, Any, List, Optional
import math

# Baseline recurrence likelihood by civic category (based on municipal repair durability statistics)
CATEGORY_RECURRENCE_BASELINES: Dict[str, float] = {
    "pothole": 0.42,          # High asphalt degradation rate in monsoons
    "garbage": 0.68,          # Chronic black spot behavior without structural enforcement
    "safety_concern": 0.35,   # Streetlight filament failure / repeat harassment stretches
    "infrastructure": 0.25,   # Broken footpaths / signages
    "utility_outage": 0.45,   # Frequent feeder trips / water pipe pressure bursts
    "accessibility": 0.20,    # Ramps/tactile paving once fixed tend to stay fixed longer
    "noise": 0.55,            # Recurring commercial/construction violations
}

def predict_recurrence_risk(
    mission_type: str,
    submission_count: int = 1,
    past_reopen_count: int = 0,
    ward_recurrence_rate: float = 0.30,
    is_monsoon_season: bool = False,
    is_high_traffic_corridor: bool = False,
    avg_jolt_intensity: Optional[float] = None
) -> Dict[str, Any]:
    """
    Computes statistical recurrence risk score (0.0 to 1.0) and explanatory factors.
    """
    cat = (mission_type or "pothole").lower()
    base_prob = CATEGORY_RECURRENCE_BASELINES.get(cat, 0.30)
    
    # Calculate logit / linear odds adjustments
    risk_factors: List[str] = []
    
    # Convert base probability to log-odds
    # log_odds = ln(p / (1 - p))
    clamped_base = max(0.05, min(0.95, base_prob))
    log_odds = math.log(clamped_base / (1.0 - clamped_base))
    
    # 1. Past Reopen History (strongest predictor)
    if past_reopen_count > 0:
        boost = past_reopen_count * 0.75
        log_odds += boost
        risk_factors.append(f"Previously reopened {past_reopen_count} time{'s' if past_reopen_count > 1 else ''}")
    
    # 2. Submission Density / Reporter Volume
    if submission_count >= 10:
        log_odds += 0.40
        risk_factors.append("High report density (chronic civic hotspot)")
    elif submission_count >= 5:
        log_odds += 0.20
        risk_factors.append("Multiple citizen reports recorded")

    # 3. High traffic / Jolt intensity
    if avg_jolt_intensity and avg_jolt_intensity > 2.5:
        log_odds += 0.35
        risk_factors.append(f"Heavy vehicle impact zone (avg jolt {avg_jolt_intensity:.1f}g)")
    elif is_high_traffic_corridor:
        log_odds += 0.25
        risk_factors.append("Arterial high-traffic road segment")

    # 4. Seasonal Monsoon / Weather Vulnerability
    if is_monsoon_season and cat in ("pothole", "utility_outage", "infrastructure"):
        log_odds += 0.30
        risk_factors.append("Active monsoon waterlogging vulnerability")

    # 5. Ward Baseline
    if ward_recurrence_rate > 0.40:
        log_odds += 0.20
        risk_factors.append("Above-average ward historical recurrence rate")

    # Sigmoid to convert back to probability
    final_prob = 1.0 / (1.0 + math.exp(-log_odds))
    final_prob = round(max(0.05, min(0.98, final_prob)), 3)

    if final_prob >= 0.65:
        risk_level = "high"
        recommendation = "Monitor this one — high recurrence risk"
    elif final_prob >= 0.38:
        risk_level = "medium"
        recommendation = "Standard follow-up verification advised"
    else:
        risk_level = "low"
        recommendation = "Low recurrence risk — standard closure"

    return {
        "category": cat,
        "recurrence_risk_score": final_prob,
        "recurrence_probability_pct": int(final_prob * 100),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "recommendation": recommendation,
        "is_high_risk": final_prob >= 0.65
    }
