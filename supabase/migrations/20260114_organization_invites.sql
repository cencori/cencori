-- Organization Invites Table
-- Run this migration in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick token lookups
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON organization_invites(organization_id);

-- RLS Policies
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Org members can view invites for their organization
CREATE POLICY "Org members can view invites" ON organization_invites 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = organization_invites.organization_id 
    AND om.user_id = auth.uid()
  )
);

-- Owner/admin can create invites
CREATE POLICY "Owner or admin can create invites" ON organization_invites 
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = organization_invites.organization_id 
    AND o.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = organization_invites.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin'
  )
);

-- Owner/admin can update invites (e.g., mark as accepted)
CREATE POLICY "Owner or admin can update invites" ON organization_invites 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = organization_invites.organization_id 
    AND o.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = organization_invites.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin'
  )
);

-- Owner/admin can delete invites
CREATE POLICY "Owner or admin can delete invites" ON organization_invites 
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = organization_invites.organization_id 
    AND o.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = organization_invites.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role = 'admin'
  )
);

-- Allow users to view invites sent to their email (for accepting)
CREATE POLICY "Users can view their own invites" ON organization_invites 
FOR SELECT USING (
  lower(email) = lower(auth.jwt() ->> 'email')
);
