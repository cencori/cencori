-- Geographic Tracking for AI Requests
-- Adds country_code and ip_address for geographic analytics

-- Add geographic columns to ai_requests
ALTER TABLE public.ai_requests 
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Create index for geographic queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_country_code 
ON public.ai_requests(country_code);

-- Create index for project + country aggregation
CREATE INDEX IF NOT EXISTS idx_ai_requests_project_country 
ON public.ai_requests(project_id, country_code);

-- Add comments
COMMENT ON COLUMN public.ai_requests.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., US, NG, GB)';
COMMENT ON COLUMN public.ai_requests.ip_address IS 'Client IP address for geo-resolution (hashed for privacy)';
