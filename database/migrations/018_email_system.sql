-- Email sender profiles for team members
CREATE TABLE IF NOT EXISTS email_sender_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email_handle TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (email_handle)
);

-- Email send history
CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'announcement',
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  sender_profile_id UUID REFERENCES email_sender_profiles(id) ON SET NULL,
  sent_by UUID REFERENCES auth.users(id),
  audience_type TEXT NOT NULL DEFAULT 'bulk',
  single_recipient TEXT,
  recipient_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_category ON email_sends(category);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sender_profiles_user ON email_sender_profiles(user_id);

-- RLS
ALTER TABLE email_sender_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

-- Only service_role can access these tables (internal admin routes use supabaseAdmin)
CREATE POLICY "Service role full access on email_sender_profiles"
  ON email_sender_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_sends"
  ON email_sends FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
