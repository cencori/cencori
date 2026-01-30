-- Add logs column to scan_runs table
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS logs JSONB;

-- Add short slug for easier identification
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create function to generate short slug
CREATE OR REPLACE FUNCTION generate_scan_slug()
RETURNS TRIGGER AS $$
BEGIN
    NEW.slug := 'scan-' || SUBSTRING(NEW.id::TEXT, 1, 8);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug
DROP TRIGGER IF EXISTS trigger_scan_runs_slug ON scan_runs;
CREATE TRIGGER trigger_scan_runs_slug
BEFORE INSERT ON scan_runs
FOR EACH ROW
EXECUTE FUNCTION generate_scan_slug();

-- Update existing rows with slugs
UPDATE scan_runs SET slug = 'scan-' || SUBSTRING(id::TEXT, 1, 8) WHERE slug IS NULL;
