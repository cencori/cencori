-- Migration to add Flutterwave fields
ALTER TABLE organizations 
ADD COLUMN flutterwave_customer_id TEXT,
ADD COLUMN flutterwave_sub_id TEXT;

-- Index for faster lookups
CREATE INDEX idx_organizations_flutterwave_customer_id ON organizations(flutterwave_customer_id);
