-- Add avatar_url column to sender profiles
ALTER TABLE email_sender_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
