-- Newsletter Subscribers
-- Public-facing newsletter subscription with double opt-in.
-- Subscribers are NOT Cencori users — these are independent email-only contacts.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
    confirmation_token TEXT NOT NULL UNIQUE,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    source TEXT,
    tags TEXT[] DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ,
    bounce_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_newsletter_subscribers_status ON newsletter_subscribers(status);
CREATE INDEX idx_newsletter_subscribers_email ON newsletter_subscribers(LOWER(email));
CREATE INDEX idx_newsletter_subscribers_confirmation_token ON newsletter_subscribers(confirmation_token);
CREATE INDEX idx_newsletter_subscribers_unsubscribe_token ON newsletter_subscribers(unsubscribe_token);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Subscribers table is service-role only. The public subscribe / confirm /
-- unsubscribe endpoints all use the admin client, and the internal email
-- compose surface also goes through the admin client. No anon access at all.

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Cencori staff can read for the dashboard
CREATE POLICY "cencori_subscribers_select" ON newsletter_subscribers
    FOR SELECT USING (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

-- Everything else (insert/update/delete) goes through service role.
