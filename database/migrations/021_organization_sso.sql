-- SSO/SAML configuration for organizations
-- Stores the link between an organization and its Supabase SSO provider

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sso_provider_id TEXT,           -- Supabase SSO provider ID
  ADD COLUMN IF NOT EXISTS sso_domain TEXT,                -- e.g. "acme.com" for domain-based login
  ADD COLUMN IF NOT EXISTS sso_enforce BOOLEAN NOT NULL DEFAULT false,  -- Force SSO-only login for org members
  ADD COLUMN IF NOT EXISTS sso_configured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sso_configured_by UUID REFERENCES auth.users(id);

-- Index for fast domain lookups during login
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_sso_domain
  ON organizations (sso_domain)
  WHERE sso_domain IS NOT NULL AND sso_enabled = true;

-- Only enterprise orgs should have SSO — enforced at app level, not DB level
