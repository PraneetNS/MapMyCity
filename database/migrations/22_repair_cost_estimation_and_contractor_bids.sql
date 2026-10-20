-- Migration 22: Defect Repair Cost Estimation, Bill of Materials (BOM), and Contractor Bidding
-- Provides automated municipal cost forecasting, material requirements (asphalt, aggregate, emulsion),
-- and contractor competitive tender management.

-- 1. Defect Repair Estimates table
CREATE TABLE IF NOT EXISTS defect_repair_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    defect_type VARCHAR(64) NOT NULL DEFAULT 'pothole',
    surface_area_sqm NUMERIC(8, 2) NOT NULL,
    average_depth_cm NUMERIC(6, 2) NOT NULL DEFAULT 5.0,
    estimated_volume_cum NUMERIC(8, 3) NOT NULL,
    material_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    equipment_cost_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    labor_cost_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    material_cost_inr NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_estimated_cost_inr NUMERIC(10, 2) NOT NULL,
    estimated_repair_duration_hours NUMERIC(6, 1) NOT NULL DEFAULT 4.0,
    estimated_carbon_kg NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    confidence_score NUMERIC(4, 2) NOT NULL DEFAULT 0.85,
    schedule_standard VARCHAR(32) NOT NULL DEFAULT 'CPWD_DSR_2024',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Contractor Repair Bids table
CREATE TABLE IF NOT EXISTS contractor_repair_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID REFERENCES defect_repair_estimates(id) ON DELETE CASCADE,
    contractor_name VARCHAR(128) NOT NULL,
    contractor_license_no VARCHAR(64) NOT NULL,
    bid_amount_inr NUMERIC(10, 2) NOT NULL,
    proposed_duration_hours NUMERIC(6, 1) NOT NULL,
    warranty_months INTEGER NOT NULL DEFAULT 12,
    asphalt_mix_grade VARCHAR(48) NOT NULL DEFAULT 'VG-30_BITUMEN_CONCRETE',
    status VARCHAR(24) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
    submission_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Pedestrian and Cyclist Safety Audits table
CREATE TABLE IF NOT EXISTS pedestrian_safety_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id VARCHAR(64) NOT NULL,
    corridor_name VARCHAR(128) NOT NULL,
    pedestrian_hazard_index NUMERIC(5, 2) NOT NULL, -- 0 (ultra-safe) to 100 (extreme danger)
    sidewalk_continuity_pct NUMERIC(5, 2) NOT NULL DEFAULT 50.0,
    illumination_adequacy_pct NUMERIC(5, 2) NOT NULL DEFAULT 60.0,
    tactile_paving_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    open_hazard_count INTEGER NOT NULL DEFAULT 0,
    risk_tier VARCHAR(24) NOT NULL DEFAULT 'MODERATE_RISK' CHECK (risk_tier IN ('LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK', 'SEVERE_VULNERABILITY')),
    audit_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_repair_estimates_cluster ON defect_repair_estimates(cluster_id);
CREATE INDEX IF NOT EXISTS idx_repair_bids_estimate ON contractor_repair_bids(estimate_id);
CREATE INDEX IF NOT EXISTS idx_repair_bids_status ON contractor_repair_bids(status);
CREATE INDEX IF NOT EXISTS idx_pedestrian_audits_ward ON pedestrian_safety_audits(ward_id);
CREATE INDEX IF NOT EXISTS idx_pedestrian_audits_tier ON pedestrian_safety_audits(risk_tier);
