-- Migration 21: Automated Dispatch, Contractor Work Orders, and SLA Escalations
-- Supports autonomous municipal triage, rule-based contractor routing, and escalation tracking.

-- 1. Municipal Departments table
CREATE TABLE IF NOT EXISTS municipal_departments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    short_code VARCHAR(16) UNIQUE NOT NULL,
    category_handles TEXT[] NOT NULL DEFAULT '{}',
    default_sla_hours INTEGER NOT NULL DEFAULT 72,
    emergency_sla_hours INTEGER NOT NULL DEFAULT 24,
    escalation_contact_email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Contractor Work Orders table
CREATE TABLE IF NOT EXISTS contractor_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) UNIQUE NOT NULL,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    ward_id VARCHAR(64) NOT NULL,
    department_id VARCHAR(64) REFERENCES municipal_departments(id) ON DELETE SET NULL,
    contractor_name VARCHAR(128) NOT NULL,
    contractor_contact VARCHAR(128),
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY')),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'REJECTED')),
    sla_deadline TIMESTAMPTZ NOT NULL,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    materials_cost NUMERIC(10, 2) DEFAULT 0.00,
    resolution_proof_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Work Order Event Log table
CREATE TABLE IF NOT EXISTS work_order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES contractor_work_orders(id) ON DELETE CASCADE,
    event_type VARCHAR(48) NOT NULL,
    actor_id VARCHAR(128) NOT NULL DEFAULT 'SYSTEM_AUTODISPATCH',
    previous_status VARCHAR(24),
    new_status VARCHAR(24),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SLA Escalation Rules table
CREATE TABLE IF NOT EXISTS sla_escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id VARCHAR(64) REFERENCES municipal_departments(id) ON DELETE CASCADE,
    priority VARCHAR(16) NOT NULL,
    max_resolution_hours INTEGER NOT NULL,
    warning_threshold_percent INTEGER NOT NULL DEFAULT 75,
    auto_escalate_to VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_ward_status ON contractor_work_orders(ward_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_deadline ON contractor_work_orders(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_work_orders_cluster ON contractor_work_orders(cluster_id);
CREATE INDEX IF NOT EXISTS idx_work_order_events_woid ON work_order_events(work_order_id);

-- Seed core municipal departments if not already present
INSERT INTO municipal_departments (id, name, short_code, category_handles, default_sla_hours, emergency_sla_hours, escalation_contact_email)
VALUES
    ('dept_roads', 'Roads & Infrastructure Engineering', 'ROADS', ARRAY['pothole', 'road_crack', 'surface_damage', 'manhole_cover'], 48, 12, 'dispatch.roads@bbmp.gov.in'),
    ('dept_drainage', 'Stormwater & Urban Drainage', 'DRAIN', ARRAY['waterlogging', 'drainage_clog', 'flooding', 'gutter_overflow'], 24, 6, 'dispatch.drainage@bbmp.gov.in'),
    ('dept_electrical', 'Street Lighting & Public Power', 'ELEC', ARRAY['streetlight_out', 'wire_snapped', 'transformer_spark'], 36, 12, 'dispatch.lighting@bbmp.gov.in'),
    ('dept_sanitation', 'Solid Waste & Public Sanitation', 'SWM', ARRAY['garbage_dump', 'debris_pile', 'hazardous_waste'], 24, 8, 'dispatch.sanitation@bbmp.gov.in')
ON CONFLICT (id) DO NOTHING;
