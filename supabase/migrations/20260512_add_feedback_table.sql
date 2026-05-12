-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    type TEXT NOT NULL, -- 'general', 'integration_suggestion', etc.
    content TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'new', -- 'new', 'reviewed', 'implemented', 'discarded'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback" 
ON public.feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Only service role/admins can view feedback (for now, or we can add an admin role check)
CREATE POLICY "Service role can do everything" 
ON public.feedback 
TO service_role 
USING (true) 
WITH CHECK (true);
