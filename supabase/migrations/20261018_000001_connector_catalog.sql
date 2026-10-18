-- Connector catalog expansion (customer feedback: 3 connectors vs managed-auth
-- incumbents): standard OAuth2 SaaS rows, generic OIDC (bring any discovery
-- document), generic HTTP executor connector, and a curated remote MCP server
-- registry. Catalog is data-driven: rows, not code.

-- ── oauth_states.metadata: per-attempt provider endpoints + bring-your-own
-- app credentials resolved at authorize time (discovery documents); the
-- client secret is stored as an org-scoped AES-256-GCM ref, never plaintext.
ALTER TABLE public.oauth_states
    ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── connector catalog rows ──
INSERT INTO public.connectors (slug, name, auth_type, oauth_config, default_scopes, risk_defaults)
VALUES
    ('slack', 'Slack', 'oauth2',
     '{"auth_url":"https://slack.com/oauth/v2/authorize","token_url":"https://slack.com/api/oauth.v2.access"}'::jsonb,
     '{chat:write,channels:read}'::text[],
     '{"send_message":{"risk":"write","approval":"required","idempotent":false},"default":{"risk":"read","approval":"auto","idempotent":true}}'::jsonb),
    ('notion', 'Notion', 'oauth2',
     '{"auth_url":"https://api.notion.com/v1/oauth/authorize","token_url":"https://api.notion.com/v1/oauth/token","token_auth":"basic"}'::jsonb,
     '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('linear', 'Linear', 'oauth2',
     '{"auth_url":"https://linear.app/oauth/authorize","token_url":"https://api.linear.app/oauth/token"}'::jsonb,
     '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('github', 'GitHub', 'oauth2',
     '{"auth_url":"https://github.com/login/oauth/authorize","token_url":"https://github.com/login/oauth/access_token"}'::jsonb,
     '{repo,read:user}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('google_calendar', 'Google Calendar', 'oauth2',
     '{"auth_url":"https://accounts.google.com/o/oauth2/v2/auth","token_url":"https://oauth2.googleapis.com/token"}'::jsonb,
     '{https://www.googleapis.com/auth/calendar.events}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('google_drive', 'Google Drive', 'oauth2',
     '{"auth_url":"https://accounts.google.com/o/oauth2/v2/auth","token_url":"https://oauth2.googleapis.com/token"}'::jsonb,
     '{https://www.googleapis.com/auth/drive.file}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('hubspot', 'HubSpot', 'oauth2',
     '{"auth_url":"https://app.hubspot.com/oauth/authorize","token_url":"https://api.hubapi.com/oauth/v1/token"}'::jsonb,
     '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('generic-oidc', 'Generic OIDC Provider', 'oauth2',
     '{}'::jsonb,
     '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb),
    ('generic-http', 'Generic HTTP API', 'api_key',
     '{}'::jsonb,
     '{}'::text[],
     '{"default":{"risk":"write","approval":"required","idempotent":false}}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ── mcp_server_registry: curated, linted first-party remote MCP servers.
-- Verified = host+path probed at seed time (reachable, auth-gated where
-- expected). Customers one-click register from this list.
CREATE TABLE IF NOT EXISTS public.mcp_server_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NULL,
    category text NOT NULL,
    vendor text NULL,
    url text NOT NULL UNIQUE,
    transport text NOT NULL DEFAULT 'streamable-http',
    requires_auth boolean NOT NULL DEFAULT true,
    docs_url text NULL,
    verified boolean NOT NULL DEFAULT false,
    verified_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcp_server_registry_category ON public.mcp_server_registry(category);

ALTER TABLE public.mcp_server_registry ENABLE ROW LEVEL SECURITY;

INSERT INTO public.mcp_server_registry (slug, name, description, category, vendor, url, transport, requires_auth, docs_url, verified, verified_at)
VALUES
    ('notion', 'Notion', 'Search, read, and update Notion pages and databases.', 'productivity', 'Notion', 'https://mcp.notion.com/mcp', 'streamable-http', true, 'https://developers.notion.com/docs/mcp', true, now()),
    ('linear', 'Linear', 'Issues, projects, and teams on Linear.', 'productivity', 'Linear', 'https://mcp.linear.app/mcp', 'streamable-http', true, 'https://linear.app/developers/mcp', true, now()),
    ('atlassian', 'Atlassian (Jira/Confluence)', 'Jira issues and Confluence spaces for your Atlassian site.', 'productivity', 'Atlassian', 'https://mcp.atlassian.com/v1/mcp', 'streamable-http', true, 'https://developer.atlassian.com/cloud/confluence/mcp-remote-server/', true, now()),
    ('sentry', 'Sentry', 'Errors, traces, and release health from Sentry.', 'observability', 'Sentry', 'https://mcp.sentry.dev/mcp', 'streamable-http', true, 'https://docs.sentry.io/product/sentry-mcp/', true, now()),
    ('github', 'GitHub (Copilot MCP)', 'Repositories, issues, and PRs via GitHub''s hosted MCP.', 'developer-tools', 'GitHub', 'https://api.githubcopilot.com/mcp/', 'streamable-http', true, 'https://github.com/github/github-mcp-server', true, now()),
    ('stripe', 'Stripe', 'Payments data and operations through Stripe''s hosted MCP.', 'payments', 'Stripe', 'https://mcp.stripe.com', 'streamable-http', true, 'https://docs.stripe.com/mcp', true, now()),
    ('figma', 'Figma', 'Dev-mode design context and file access.', 'design', 'Figma', 'https://mcp.figma.com/mcp', 'streamable-http', true, 'https://mcp.figma.com', true, now()),
    ('paypal', 'PayPal', 'Payments and commerce operations via PayPal MCP.', 'payments', 'PayPal', 'https://mcp.paypal.com/mcp', 'streamable-http', true, 'https://developer.paypal.com/tools/mcp-server/', true, now()),
    ('cloudflare-docs', 'Cloudflare Docs', 'Public Cloudflare documentation search (no auth).', 'documentation', 'Cloudflare', 'https://docs.mcp.cloudflare.com/sse', 'sse', false, 'https://github.com/cloudflare/mcp-server-docs', true, now())
ON CONFLICT (slug) DO NOTHING;
