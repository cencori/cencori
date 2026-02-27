-- Billing operational controls: freeze state + audit trail.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_freeze_reason text,
  ADD COLUMN IF NOT EXISTS billing_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_frozen_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.billing_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL CHECK (
    action IN ('manual_refund', 'manual_adjustment', 'freeze', 'unfreeze')
  ),
  amount numeric(14, 6),
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_org_created
  ON public.billing_audit_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_audit_events_action_created
  ON public.billing_audit_events (action, created_at DESC);

ALTER TABLE public.billing_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org owners/admins can read billing audit events" ON public.billing_audit_events;
CREATE POLICY "Org owners/admins can read billing audit events"
  ON public.billing_audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = billing_audit_events.organization_id
        AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = billing_audit_events.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
    )
  );
