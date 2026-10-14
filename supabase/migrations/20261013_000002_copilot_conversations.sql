-- Copilot history: saved conversations for the console's Cencori Copilot.
--
-- One row per conversation, owned by the user who started it and scoped to
-- an organization (and optionally the project it was opened in). Messages are
-- stored inline as a JSON array of { id, role, content }; conversations are
-- short and always read whole, so a child table would only add joins.
--
-- The browser reads and writes this table directly through RLS: a user only
-- ever sees and changes their own rows. user_id defaults to auth.uid() so the
-- client never sends it.

CREATE TABLE IF NOT EXISTS public.copilot_conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
    project_id      uuid REFERENCES public.projects (id) ON DELETE SET NULL,
    title           text NOT NULL,
    messages        jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- The history menu lists a user's conversations in one org, newest first.
CREATE INDEX IF NOT EXISTS idx_copilot_conversations_user_org_updated
    ON public.copilot_conversations (user_id, organization_id, updated_at DESC);

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own copilot conversations" ON public.copilot_conversations;
CREATE POLICY "Users read their own copilot conversations"
    ON public.copilot_conversations FOR SELECT
    USING (user_id = auth.uid());

-- Inserts must also be for an org the user belongs to.
DROP POLICY IF EXISTS "Users create their own copilot conversations" ON public.copilot_conversations;
CREATE POLICY "Users create their own copilot conversations"
    ON public.copilot_conversations FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.organization_id = copilot_conversations.organization_id
              AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users update their own copilot conversations" ON public.copilot_conversations;
CREATE POLICY "Users update their own copilot conversations"
    ON public.copilot_conversations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete their own copilot conversations" ON public.copilot_conversations;
CREATE POLICY "Users delete their own copilot conversations"
    ON public.copilot_conversations FOR DELETE
    USING (user_id = auth.uid());
