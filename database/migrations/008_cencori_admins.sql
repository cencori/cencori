-- Migration: Create cencori_admins table for internal team access
-- Run this in your Supabase SQL Editor

-- Create the cencori_admins table
CREATE TABLE IF NOT EXISTS cencori_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
    invite_token UUID DEFAULT gen_random_uuid(),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    CONSTRAINT valid_active_admin CHECK (
        status != 'active' OR user_id IS NOT NULL
    )
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cencori_admins_user_id ON cencori_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_cencori_admins_email ON cencori_admins(email);
CREATE INDEX IF NOT EXISTS idx_cencori_admins_invite_token ON cencori_admins(invite_token);
CREATE INDEX IF NOT EXISTS idx_cencori_admins_status ON cencori_admins(status);

-- Enable RLS
ALTER TABLE cencori_admins ENABLE ROW LEVEL SECURITY;

-- Policy: Only active admins can read the table
CREATE POLICY "Active admins can read cencori_admins"
ON cencori_admins FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
    )
);

-- Policy: Only super_admins can insert (invite)
CREATE POLICY "Super admins can invite"
ON cencori_admins FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.role = 'super_admin'
    )
);

-- Policy: Only super_admins can update
CREATE POLICY "Super admins can update"
ON cencori_admins FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.role = 'super_admin'
    )
);

-- Policy: Only super_admins can delete
CREATE POLICY "Super admins can delete"
ON cencori_admins FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cencori_admins ca
        WHERE ca.user_id = auth.uid()
        AND ca.status = 'active'
        AND ca.role = 'super_admin'
    )
);

-- ============================================
-- BOOTSTRAP: Add yourself as first super_admin
-- ============================================
-- Run this AFTER creating the table:
-- 
-- INSERT INTO cencori_admins (email, user_id, role, status, accepted_at)
-- SELECT 
--     'omogbolahanng@gmail.com',
--     id,
--     'super_admin',
--     'active',
--     now()
-- FROM auth.users
-- WHERE email = 'omogbolahanng@gmail.com';
