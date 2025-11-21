-- AI Gateway: Create ai_requests table for logging all AI API requests
-- This table tracks every request made through the Cencori AI Gateway

-- Create the ai_requests table
CREATE TABLE IF NOT EXISTS public.ai_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    
    -- Model information
    model TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
    
    -- Token usage
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Cost tracking (in USD)
    cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0.0,
    
    -- Performance metrics
    latency_ms INTEGER NOT NULL,
    
    -- Status tracking
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'filtered')),
    error_message TEXT,
    filtered_reasons TEXT[],
    safety_score DECIMAL(3, 2),
    
    -- Request/Response data (sanitized)
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_project_id ON public.ai_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON public.ai_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON public.ai_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_requests_project_created ON public.ai_requests(project_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy: Users can view AI requests for projects in their organizations
CREATE POLICY "Users can view ai_requests for their organization projects"
    ON public.ai_requests
    FOR SELECT
    USING (
        project_id IN (
            SELECT p.id 
            FROM public.projects p
            JOIN public.organization_members om ON om.organization_id = p.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Create RLS Policy: System can insert AI requests (using service role)
CREATE POLICY "Service role can insert ai_requests"
    ON public.ai_requests
    FOR INSERT
    WITH CHECK (true);

-- Create RLS Policy: System can update AI requests (using service role)
CREATE POLICY "Service role can update ai_requests"
    ON public.ai_requests
    FOR UPDATE
    USING (true);

-- Add comment to table
COMMENT ON TABLE public.ai_requests IS 'Logs all AI API requests made through the Cencori AI Gateway';
