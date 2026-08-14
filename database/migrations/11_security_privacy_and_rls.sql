-- Migration 11: User Roles & Postgres Row Level Security (RLS) Hardening Policies

-- 1. Add User Role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'citizen' 
    CHECK (role IN ('citizen', 'moderator', 'municipal_partner', 'super_admin'));

-- 2. Enable Row Level Security on all core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE utility_status_reports ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Public Read Access for Approved Civic Submissions & Clusters
DROP POLICY IF EXISTS public_select_approved_submissions ON submissions;
CREATE POLICY public_select_approved_submissions ON submissions 
    FOR SELECT USING (status IN ('approved', 'pending', 'acknowledged', 'in_progress', 'resolved_pending_verification', 'verified_fixed'));

DROP POLICY IF EXISTS public_select_accessibility_audits ON accessibility_audits;
CREATE POLICY public_select_accessibility_audits ON accessibility_audits 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS public_select_utility_reports ON utility_status_reports;
CREATE POLICY public_select_utility_reports ON utility_status_reports 
    FOR SELECT USING (true);

-- 4. RLS Policies: Authenticated Service Role Full Access
DROP POLICY IF EXISTS service_role_all_submissions ON submissions;
CREATE POLICY service_role_all_submissions ON submissions 
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS service_role_all_users ON users;
CREATE POLICY service_role_all_users ON users 
    FOR ALL USING (auth.role() = 'service_role');
