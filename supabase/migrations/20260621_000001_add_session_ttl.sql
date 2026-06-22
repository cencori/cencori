-- Session TTL: auto-expire stale paused sessions

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON public.sessions(status, expires_at)
    WHERE status = 'paused';
