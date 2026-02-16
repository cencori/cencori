-- Migration: Add billing address fields to organizations
-- Description: Adds columns to store the billing address and tax ID.
-- Created: 2026-02-15

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_zip TEXT,
ADD COLUMN IF NOT EXISTS billing_country TEXT,
ADD COLUMN IF NOT EXISTS billing_tax_id TEXT;

-- Helpful comments
COMMENT ON COLUMN organizations.billing_address_line1 IS 'Billing address line 1';
COMMENT ON COLUMN organizations.billing_address_line2 IS 'Billing address line 2';
COMMENT ON COLUMN organizations.billing_city IS 'Billing address city';
COMMENT ON COLUMN organizations.billing_state IS 'Billing address state or province';
COMMENT ON COLUMN organizations.billing_zip IS 'Billing address postal code';
COMMENT ON COLUMN organizations.billing_country IS 'Billing address country code';
COMMENT ON COLUMN organizations.billing_tax_id IS 'Organization tax ID';
