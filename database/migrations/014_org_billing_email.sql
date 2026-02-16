-- Migration: Add billing email to organizations
-- Description: Adds a column to store the preferred email for billing correspondence.
-- Created: 2026-02-15

ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Helpful comment
COMMENT ON COLUMN organizations.billing_email IS 'Primary email address for billing-related notifications and receipt delivery.';
